import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteConfirmModal } from '../delete-confirm-modal';
import { useProjectStore } from '../../../stores/project-store';

vi.mock('../../../utils/file-api', () => ({
  deleteFile: vi.fn(async () => {}),
  extractFilename: (p: string) => p.split('/').pop() ?? p,
  clearActiveProject: vi.fn(async () => {}),
}));

import { deleteFile } from '../../../utils/file-api';

describe('DeleteConfirmModal identity race', () => {
  beforeEach(() => {
    vi.mocked(deleteFile).mockClear();
    useProjectStore.setState({ filePath: '/projects/A.bshot', isOpen: true, isDirty: false });
  });

  it('deletes the snapshotted path even if the store moves on to another project mid-flight', async () => {
    const onClose = vi.fn();
    render(<DeleteConfirmModal filePath="/projects/A.bshot" onClose={onClose} />);

    fireEvent.click(screen.getByText('Move to Trash'));

    // Simulate another project being opened while A's delete is in flight
    // (the shared transition lock normally prevents this from happening in
    // the real app — see project-io.ts's guardedProjectTransition — this
    // test exercises the modal's own defensive check independently).
    useProjectStore.setState({ filePath: '/projects/B.bshot', isOpen: true, isDirty: false });

    await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('/projects/A.bshot', true));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // Project B must still be the open project — its state must not be
    // cleared as a side effect of A's deletion completing.
    expect(useProjectStore.getState().filePath).toBe('/projects/B.bshot');
    expect(useProjectStore.getState().isOpen).toBe(true);
  });

  it('clears in-memory state when the deleted project is still the open one', async () => {
    const onClose = vi.fn();
    render(<DeleteConfirmModal filePath="/projects/A.bshot" onClose={onClose} />);

    fireEvent.click(screen.getByText('Move to Trash'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(useProjectStore.getState().filePath).toBeNull();
    expect(useProjectStore.getState().isOpen).toBe(false);
  });
});
