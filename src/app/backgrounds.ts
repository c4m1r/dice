import { TableBackgroundSetting } from './types';

export type TableBackgroundPreset = {
  id: string;
  label: string;
  dataUrl: string;
  repeat: number;
};

const makeSvgDataUrl = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const tableBackgroundPresets: TableBackgroundPreset[] = [
  {
    id: 'light',
    label: 'Светлый',
    repeat: 2,
    dataUrl: makeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#e2e8f0"/>
        <path d="M0 40h240M0 120h240M0 200h240" stroke="#cbd5f5" stroke-width="6"/>
        <path d="M40 0v240M120 0v240M200 0v240" stroke="#b4c3f1" stroke-width="6"/>
        <path d="M0 0L240 240M240 0L0 240" stroke="#d6def6" stroke-width="4"/>
      </svg>
    `),
  },
  {
    id: 'dark',
    label: 'Тёмный',
    repeat: 2,
    dataUrl: makeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#0f172a"/>
        <path d="M0 60h240M0 120h240M0 180h240" stroke="#1e293b" stroke-width="8"/>
        <path d="M60 0v240M120 0v240M180 0v240" stroke="#334155" stroke-width="6"/>
        <circle cx="120" cy="120" r="54" fill="none" stroke="#1f2937" stroke-width="6"/>
      </svg>
    `),
  },
  {
    id: 'warm',
    label: 'Тёплый',
    repeat: 2,
    dataUrl: makeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#3b1c0f"/>
        <path d="M0 30h240M0 90h240M0 150h240M0 210h240" stroke="#7c2d12" stroke-width="6"/>
        <path d="M30 0v240M90 0v240M150 0v240M210 0v240" stroke="#a16207" stroke-width="6"/>
        <path d="M0 240L240 0" stroke="#92400e" stroke-width="4"/>
      </svg>
    `),
  },
  {
    id: 'cool',
    label: 'Холодный',
    repeat: 2,
    dataUrl: makeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#0b1b2a"/>
        <path d="M0 48h240M0 144h240" stroke="#0f4c81" stroke-width="8"/>
        <path d="M48 0v240M144 0v240" stroke="#1e40af" stroke-width="6"/>
        <path d="M0 0L240 240" stroke="#0ea5e9" stroke-width="4"/>
        <path d="M240 0L0 240" stroke="#0284c7" stroke-width="4"/>
      </svg>
    `),
  },
];

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
