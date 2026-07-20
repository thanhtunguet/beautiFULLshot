// File API - TypeScript wrappers for Tauri file operations

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ProjectLoadResult, ProjectSaveData } from '../types/project';
import type { ExportFormat } from '../stores/export-store';

/**
 * Normalize Windows extended-length path prefix (\\?\)
 * Windows dialog can return paths like \\?\C:\Users\... which need cleanup for display
 */
export function normalizePath(path: string): string {
  // Remove Windows extended-length path prefix
  if (path.startsWith('\\\\?\\')) {
    return path.slice(4);
  }
  return path;
}

/**
 * Extract filename from path (cross-platform)
 */
export function extractFilename(path: string): string {
  // Normalize first to handle \\?\ prefix
  const normalized = normalizePath(path);
  // Handle both Windows (\) and Unix (/) separators
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || 'image';
}

/**
 * Save file using Tauri backend
 */
export async function saveFile(
  path: string,
  data: Uint8Array
): Promise<string> {
  return await invoke('save_file', {
    path,
    data: Array.from(data),
  });
}

/**
 * Get (and create if needed) the beautiFULLshot project directory.
 * Returns ~/Pictures/beautiFULLshot on all platforms.
 */
export async function getProjectDir(): Promise<string> {
  return await invoke<string>('get_project_dir');
}

/**
 * Show native save dialog for image export
 * Defaults to the beautiFULLshot project directory
 */
export async function showSaveDialog(
  defaultName: string,
  format: ExportFormat
): Promise<string | null> {
  const filters =
    format === 'png'
      ? [{ name: 'PNG Image', extensions: ['png'] }]
      : [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }];

  const projectDir = await getProjectDir();
  const path = await save({
    defaultPath: `${projectDir}/${defaultName}`,
    filters,
  });

  return path;
}

/**
 * Read a .bshot project file (ZIP archive)
 * Returns metadata and raw screenshot bytes from the Rust backend
 */
export async function readProject(path: string): Promise<ProjectLoadResult> {
  return await invoke<ProjectLoadResult>('read_project', { path });
}

/**
 * Write a .bshot project file (ZIP archive)
 * Serializes metadata and screenshot bytes into a ZIP via Rust
 */
export async function writeProject(
  path: string,
  data: ProjectSaveData
): Promise<string> {
  return await invoke<string>('write_project', {
    path,
    metadata: data.metadata,
    screenshotBytes: data.screenshotBytes,
  });
}

/**
 * Delete a file from disk
 * @param moveToTrash — if true, use system trash; otherwise permanent delete
 */
export async function deleteFile(
  path: string,
  moveToTrash: boolean
): Promise<void> {
  await invoke('delete_file', { path, moveToTrash });
}

/**
 * Show native open file dialog — accepts both .bshot projects and image files
 * Defaults to the beautiFULLshot project directory (~/Pictures/beautiFULLshot)
 * Returns the selected file path, or null if cancelled
 */
export async function showOpenDialog(): Promise<string | null> {
  const projectDir = await getProjectDir();
  const selected = await open({
    defaultPath: projectDir,
    filters: [
      { name: 'All Supported', extensions: ['bshot', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
      { name: 'beautiFULLshot Project', extensions: ['bshot'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
    ],
    multiple: false,
  });

  return selected as string | null;
}

/**
 * Read a binary file from disk (used for opening image files via File > Open)
 */
export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const bytes: number[] = await invoke<number[]>('read_binary_file', { path });
  return new Uint8Array(bytes);
}
