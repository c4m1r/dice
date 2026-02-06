export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';
export type Language = 'ru' | 'en' | 'ko' | 'zh' | 'es' | 'ja';

export type TableBackgroundSetting =
  | { type: 'preset'; id: string }
  | { type: 'custom'; dataUrl: string };

export interface DicePool {
  d4: number;
  d6: number;
  d8: number;
  d10: number;
  d12: number;
  d20: number;
  modifier: number;
}

export interface DieResult {
  type: DieType;
  value: number;
}

export interface RollEvent {
  id: string;
  timestamp: number;
  mode: 'roll' | 'divination';
  view: '2d' | '3d';
  subMode?: string;
  pool: DicePool;
  results: DieResult[];
  total: number;
  interpretationText?: string;
}

export interface AppSettings {
  view: '2d' | '3d';
  mode: 'roll' | 'divination';
  divinationSubMode: 'one-die' | 'two-dice' | 'three-dice';
  throwForce: number;
  spinForce: number;
  maxDiceOnTable: number;
  resultByPhysics: boolean;
  reducedMotion: boolean;
  tableBackground: TableBackgroundSetting;
  language: Language;
  welcomeShown: boolean;
}

export interface AppState {
  pool: DicePool;
  settings: AppSettings;
  history: RollEvent[];
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  menuDrawerOpen: boolean;
  isRolling: boolean;
  lastSelectedDie: DieType;
}
