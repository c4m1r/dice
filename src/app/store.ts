import { create } from 'zustand';
import { AppState, DicePool, RollEvent, AppSettings, DieType, Language } from './types';
import { loadSettings, saveSettings, loadHistory, saveHistory } from './persistence';

const defaultPool: DicePool = {
  d2: 0,
  d4: 0,
  d5: 0,
  d6: 0,
  d8: 0,
  d10: 0,
  d12: 0,
  d20: 1,
  modifier: 0,
};

const defaultSettings: AppSettings = {
  view: '3d',
  mode: 'roll',
  divinationSubMode: 'one-die',
  throwForce: 25,
  spinForce: 20,
  maxDiceOnTable: 12,
  resultByPhysics: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  tableBackground: { type: 'preset', id: 'dark' },
  language: 'en',
  welcomeShown: false,
};

export const useAppStore = create<AppState & {
  updatePool: (updates: Partial<DicePool>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addToHistory: (event: RollEvent) => void;
  clearHistory: () => void;
  toggleLeftDrawer: () => void;
  toggleRightDrawer: () => void;
  toggleMenuDrawer: () => void;
  setIsRolling: (rolling: boolean) => void;
  setLastSelectedDie: (die: DieType) => void;
}>((set, get) => ({
  pool: defaultPool,
  settings: { ...defaultSettings, ...loadSettings() },
  history: loadHistory(),
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  menuDrawerOpen: false,
  isRolling: false,
  lastSelectedDie: 'd20',

  updatePool: (updates) => {
    set((state) => ({ pool: { ...state.pool, ...updates } }));
  },

  updateSettings: (updates) => {
    const newSettings = { ...get().settings, ...updates };
    set({ settings: newSettings });
    saveSettings(newSettings);
  },

  addToHistory: (event) => {
    const history = [event, ...get().history].slice(0, 200);
    set({ history });
    saveHistory(history);
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistory([]);
  },

  toggleLeftDrawer: () => {
    set((state) => ({ leftDrawerOpen: !state.leftDrawerOpen }));
  },

  toggleRightDrawer: () => {
    set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen }));
  },

  toggleMenuDrawer: () => {
    set((state) => ({ menuDrawerOpen: !state.menuDrawerOpen }));
  },

  setIsRolling: (rolling) => {
    set({ isRolling: rolling });
  },

  setLastSelectedDie: (die) => {
    set({ lastSelectedDie: die });
  },
}));
