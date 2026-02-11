import { TableBackgroundSetting } from './types';

export type TableBackgroundPreset = {
  id: string;
  label: string;
  dataUrl: string;
  repeat: number;
};

import { createTexture } from './textureGenerator';


export const tableBackgroundPresets: TableBackgroundPreset[] = [
  {
    id: 'light',
    label: 'Мрамор', // Was 'Светлый'
    repeat: 1,
    dataUrl: createTexture('stone'), // Generated on load (or we could cache/memoize)
  },
  {
    id: 'dark',
    label: 'Сукно', // Was 'Тёмный'
    repeat: 1,
    dataUrl: createTexture('felt'),
  },
  {
    id: 'warm',
    label: 'Дерево', // Was 'Тёплый'
    repeat: 1,
    dataUrl: createTexture('wood'),
  },
  {
    id: 'cool',
    label: 'Космос', // Was 'Холодный'
    repeat: 1,
    dataUrl: createTexture('galaxy'),
  },];

export const resolveTableBackground = (
  setting: TableBackgroundSetting
): { url?: string; repeat: number } => {
  if (setting.type === 'custom') {
    return { url: setting.dataUrl, repeat: 1 };
  }

  const preset = tableBackgroundPresets.find((item) => item.id === setting.id);
  if (!preset) {
    return { url: tableBackgroundPresets[1].dataUrl, repeat: 2 };
  }
  return { url: preset.dataUrl, repeat: preset.repeat };
};
