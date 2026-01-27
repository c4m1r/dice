import { AppSettings, RollEvent } from './types';

const SETTINGS_KEY = 'dice_table_settings';
const HISTORY_KEY = 'dice_table_history';

export const loadSettings = (): Partial<AppSettings> => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
};

export const loadHistory = (): RollEvent[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveHistory = (history: RollEvent[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save history:', error);
  }
};