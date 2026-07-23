import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, isValidHotkey, migrateSettings } from '../settings-store';

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useSettingsStore.setState({
      hotkeys: {
        capture: 'CommandOrControl+Shift+C',
        captureRegion: 'CommandOrControl+Shift+R',
        captureWindow: 'CommandOrControl+Shift+W',
        save: 'CommandOrControl+S',
        copy: 'CommandOrControl+Shift+V',
      },
      startMinimized: false,
      closeToTray: true,
      showNotifications: true,
      saveLocation: 'default',
      customSavePath: null,
    });
  });

  describe('Initial State', () => {
    it('should have default hotkeys', () => {
      const state = useSettingsStore.getState();
      expect(state.hotkeys.capture).toBe('CommandOrControl+Shift+C');
      expect(state.hotkeys.save).toBe('CommandOrControl+S');
    });

    it('should have closeToTray enabled by default', () => {
      const state = useSettingsStore.getState();
      expect(state.closeToTray).toBe(true);
    });

    it('should have showNotifications enabled by default', () => {
      const state = useSettingsStore.getState();
      expect(state.showNotifications).toBe(true);
    });

    it('should have startMinimized disabled by default', () => {
      const state = useSettingsStore.getState();
      expect(state.startMinimized).toBe(false);
    });

    it('should have default as default save location', () => {
      const state = useSettingsStore.getState();
      expect(state.saveLocation).toBe('default');
    });

    it('should have null customSavePath by default', () => {
      const state = useSettingsStore.getState();
      expect(state.customSavePath).toBeNull();
    });
  });

  describe('setHotkey', () => {
    it('should update capture hotkey', () => {
      useSettingsStore.getState().setHotkey('capture', 'Alt+C');
      expect(useSettingsStore.getState().hotkeys.capture).toBe('Alt+C');
    });

    it('should update save hotkey', () => {
      useSettingsStore.getState().setHotkey('save', 'CommandOrControl+Shift+S');
      expect(useSettingsStore.getState().hotkeys.save).toBe('CommandOrControl+Shift+S');
    });

    it('should preserve other hotkeys when updating one', () => {
      const originalCopy = useSettingsStore.getState().hotkeys.copy;
      useSettingsStore.getState().setHotkey('capture', 'Alt+X');
      expect(useSettingsStore.getState().hotkeys.copy).toBe(originalCopy);
    });
  });

  describe('Behavior Settings', () => {
    it('should toggle startMinimized', () => {
      useSettingsStore.getState().setStartMinimized(true);
      expect(useSettingsStore.getState().startMinimized).toBe(true);

      useSettingsStore.getState().setStartMinimized(false);
      expect(useSettingsStore.getState().startMinimized).toBe(false);
    });

    it('should toggle closeToTray', () => {
      useSettingsStore.getState().setCloseToTray(false);
      expect(useSettingsStore.getState().closeToTray).toBe(false);

      useSettingsStore.getState().setCloseToTray(true);
      expect(useSettingsStore.getState().closeToTray).toBe(true);
    });

    it('should toggle showNotifications', () => {
      useSettingsStore.getState().setShowNotifications(false);
      expect(useSettingsStore.getState().showNotifications).toBe(false);

      useSettingsStore.getState().setShowNotifications(true);
      expect(useSettingsStore.getState().showNotifications).toBe(true);
    });
  });

  describe('Save Location', () => {
    it('should set save location to default', () => {
      useSettingsStore.getState().setSaveLocation('default');
      expect(useSettingsStore.getState().saveLocation).toBe('default');
    });

    it('should set save location to custom', () => {
      useSettingsStore.getState().setSaveLocation('custom');
      expect(useSettingsStore.getState().saveLocation).toBe('custom');
    });

    it('should set custom save path', () => {
      const customPath = '/Users/test/Screenshots';
      useSettingsStore.getState().setCustomSavePath(customPath);
      expect(useSettingsStore.getState().customSavePath).toBe(customPath);
    });

    it('should clear custom save path with null', () => {
      useSettingsStore.getState().setCustomSavePath('/some/path');
      useSettingsStore.getState().setCustomSavePath(null);
      expect(useSettingsStore.getState().customSavePath).toBeNull();
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', () => {
      // Modify some settings
      useSettingsStore.getState().setHotkey('capture', 'Alt+X');
      useSettingsStore.getState().setCloseToTray(false);
      useSettingsStore.getState().setSaveLocation('custom');
      useSettingsStore.getState().setCustomSavePath('/custom/path');

      // Reset
      useSettingsStore.getState().resetToDefaults();

      const state = useSettingsStore.getState();
      // Check reset to actual DEFAULT_HOTKEYS from settings-store.ts
      expect(state.hotkeys.capture).toBe('CommandOrControl+Option+1');
      expect(state.closeToTray).toBe(true);
      expect(state.saveLocation).toBe('default');
      expect(state.customSavePath).toBeNull();
    });
  });

  describe('Combined Actions', () => {
    it('should allow updating multiple settings independently', () => {
      useSettingsStore.getState().setHotkey('capture', 'Alt+C');
      useSettingsStore.getState().setCloseToTray(false);
      useSettingsStore.getState().setSaveLocation('custom');

      const state = useSettingsStore.getState();
      expect(state.hotkeys.capture).toBe('Alt+C');
      expect(state.closeToTray).toBe(false);
      expect(state.saveLocation).toBe('custom');
    });
  });

  describe('Hotkey Validation', () => {
    it('should reject hotkeys without modifiers', () => {
      const original = useSettingsStore.getState().hotkeys.capture;
      useSettingsStore.getState().setHotkey('capture', 'C');
      // Should not change because invalid
      expect(useSettingsStore.getState().hotkeys.capture).toBe(original);
    });

    it('should reject invalid key names', () => {
      const original = useSettingsStore.getState().hotkeys.capture;
      useSettingsStore.getState().setHotkey('capture', 'Ctrl+InvalidKey');
      expect(useSettingsStore.getState().hotkeys.capture).toBe(original);
    });

    it('should accept valid hotkey combinations', () => {
      useSettingsStore.getState().setHotkey('capture', 'Alt+Shift+X');
      expect(useSettingsStore.getState().hotkeys.capture).toBe('Alt+Shift+X');
    });

    it('should allow empty string to clear hotkey', () => {
      useSettingsStore.getState().setHotkey('capture', '');
      expect(useSettingsStore.getState().hotkeys.capture).toBe('');
    });
  });
});

describe('isValidHotkey', () => {
  it('should return true for valid hotkeys', () => {
    expect(isValidHotkey('CommandOrControl+Shift+C')).toBe(true);
    expect(isValidHotkey('Alt+S')).toBe(true);
    expect(isValidHotkey('Ctrl+Shift+F1')).toBe(true);
    expect(isValidHotkey('Meta+Space')).toBe(true);
  });

  it('should return false for hotkeys without modifiers', () => {
    expect(isValidHotkey('C')).toBe(false);
    expect(isValidHotkey('F1')).toBe(false);
  });

  it('should return false for invalid modifiers', () => {
    expect(isValidHotkey('NotAModifier+C')).toBe(false);
  });

  it('should return false for invalid keys', () => {
    expect(isValidHotkey('Ctrl+NotAKey')).toBe(false);
    expect(isValidHotkey('Alt+@')).toBe(false);
  });

  it('should return false for empty or null input', () => {
    expect(isValidHotkey('')).toBe(false);
    // @ts-expect-error testing invalid input
    expect(isValidHotkey(null)).toBe(false);
    // @ts-expect-error testing invalid input
    expect(isValidHotkey(undefined)).toBe(false);
  });

  it('should be case-insensitive for validation', () => {
    expect(isValidHotkey('ctrl+shift+c')).toBe(true);
    expect(isValidHotkey('CTRL+SHIFT+C')).toBe(true);
  });
});

describe('migrateSettings', () => {
  it('remaps legacy "pictures" saveLocation to "default"', () => {
    const migrated = migrateSettings({ saveLocation: 'pictures' }, 0) as {
      saveLocation: string;
    };
    expect(migrated.saveLocation).toBe('default');
  });

  it('remaps legacy "desktop" saveLocation to "default"', () => {
    const migrated = migrateSettings({ saveLocation: 'desktop' }, 0) as {
      saveLocation: string;
    };
    expect(migrated.saveLocation).toBe('default');
  });

  it('leaves "custom" saveLocation untouched', () => {
    const migrated = migrateSettings(
      { saveLocation: 'custom', customSavePath: '/tmp' },
      0
    ) as { saveLocation: string; customSavePath: string };
    expect(migrated.saveLocation).toBe('custom');
    expect(migrated.customSavePath).toBe('/tmp');
  });

  it('does not touch state already at or above v1', () => {
    const migrated = migrateSettings({ saveLocation: 'pictures' }, 1) as {
      saveLocation: string;
    };
    // Already migrated shape — a stray legacy value is left as-is rather than
    // re-migrated, matching zustand's version-gated migration contract.
    expect(migrated.saveLocation).toBe('pictures');
  });

  it('handles undefined persisted state', () => {
    expect(migrateSettings(undefined, 0)).toBeUndefined();
  });
});
