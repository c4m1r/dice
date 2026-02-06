export type Language = 'ru' | 'en' | 'ko' | 'zh' | 'es' | 'ja';

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

export const languages: LanguageOption[] = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export interface Translations {
  welcome: {
    title: string;
    subtitle: string;
    selectLanguage: string;
    continue: string;
  };
  dice: {
    d4: string;
    d6: string;
    d8: string;
    d10: string;
    d12: string;
    d20: string;
  };
  ui: {
    menu: string;
    diceLabel: string;
    roll: string;
    throwOne: string;
    power: string;
    rolling: string;
    modifier: string;
    history: string;
    clear: string;
    repeat: string;
    copy: string;
    total: string;
    results: string;
    pool: string;
  };
  modes: {
    roll: string;
    divination: string;
  };
}

export const translations: Record<Language, Translations> = {
  ru: {
    welcome: {
      title: 'Добро пожаловать в Dice Roller',
      subtitle: 'Выберите язык для начала работы',
      selectLanguage: 'Выберите язык',
      continue: 'Продолжить',
    },
    dice: {
      d4: 'Тетраэдр (4 грани)',
      d6: 'Куб (6 граней)',
      d8: 'Октаэдр (8 граней)',
      d10: 'Десятигранник (10 граней)',
      d12: 'Додекаэдр (12 граней)',
      d20: 'Икосаэдр (20 граней)',
    },
    ui: {
      menu: 'Меню',
      diceLabel: 'Кости',
      roll: 'БРОСИТЬ',
      throwOne: 'Кинуть одну',
      power: 'Сила',
      rolling: 'Бросаю...',
      modifier: 'Модификатор',
      history: 'История',
      clear: 'Очистить',
      repeat: 'Повторить',
      copy: 'Копировать',
      total: 'Итого',
      results: 'Результаты',
      pool: 'Пул',
    },
    modes: {
      roll: 'Броски',
      divination: 'Гадания',
    },
  },
  en: {
    welcome: {
      title: 'Welcome to Dice Roller',
      subtitle: 'Select your language to get started',
      selectLanguage: 'Select Language',
      continue: 'Continue',
    },
    dice: {
      d4: 'Tetrahedron (4 sides)',
      d6: 'Cube (6 sides)',
      d8: 'Octahedron (8 sides)',
      d10: 'Decahedron (10 sides)',
      d12: 'Dodecahedron (12 sides)',
      d20: 'Icosahedron (20 sides)',
    },
    ui: {
      menu: 'Menu',
      diceLabel: 'Dice',
      roll: 'ROLL',
      throwOne: 'Throw One',
      power: 'Power',
      rolling: 'Rolling...',
      modifier: 'Modifier',
      history: 'History',
      clear: 'Clear',
      repeat: 'Repeat',
      copy: 'Copy',
      total: 'Total',
      results: 'Results',
      pool: 'Pool',
    },
    modes: {
      roll: 'Rolls',
      divination: 'Divination',
    },
  },
  ko: {
    welcome: {
      title: 'Dice Roller에 오신 것을 환영합니다',
      subtitle: '시작하려면 언어를 선택하세요',
      selectLanguage: '언어 선택',
      continue: '계속하다',
    },
    dice: {
      d4: '정사면체 (4면)',
      d6: '정육면체 (6면)',
      d8: '정팔면체 (8면)',
      d10: '정십면체 (10면)',
      d12: '정십이면체 (12면)',
      d20: '정이십면체 (20면)',
    },
    ui: {
      menu: '메뉴',
      diceLabel: '주사위',
      roll: '굴리기',
      throwOne: '하나 던지기',
      power: '힘',
      rolling: '굴리는 중...',
      modifier: '수정자',
      history: '역사',
      clear: '지우기',
      repeat: '반복',
      copy: '복사',
      total: '합계',
      results: '결과',
      pool: '풀',
    },
    modes: {
      roll: '롤',
      divination: '점',
    },
  },
  zh: {
    welcome: {
      title: '欢迎使用骰子投掷器',
      subtitle: '选择您的语言开始使用',
      selectLanguage: '选择语言',
      continue: '继续',
    },
    dice: {
      d4: '四面体（4面）',
      d6: '立方体（6面）',
      d8: '八面体（8面）',
      d10: '十面体（10面）',
      d12: '十二面体（12面）',
      d20: '二十面体（20面）',
    },
    ui: {
      menu: '菜单',
      diceLabel: '骰子',
      roll: '投掷',
      throwOne: '投一个',
      power: '力量',
      rolling: '投掷中...',
      modifier: '修正值',
      history: '历史',
      clear: '清除',
      repeat: '重复',
      copy: '复制',
      total: '总计',
      results: '结果',
      pool: '池',
    },
    modes: {
      roll: '投掷',
      divination: '占卜',
    },
  },
  es: {
    welcome: {
      title: 'Bienvenido a Dice Roller',
      subtitle: 'Selecciona tu idioma para comenzar',
      selectLanguage: 'Seleccionar idioma',
      continue: 'Continuar',
    },
    dice: {
      d4: 'Tetraedro (4 caras)',
      d6: 'Cubo (6 caras)',
      d8: 'Octaedro (8 caras)',
      d10: 'Decaedro (10 caras)',
      d12: 'Dodecaedro (12 caras)',
      d20: 'Icosaedro (20 caras)',
    },
    ui: {
      menu: 'Menú',
      diceLabel: 'Dados',
      roll: 'LANZAR',
      throwOne: 'Tirar uno',
      power: 'Poder',
      rolling: 'Lanzando...',
      modifier: 'Modificador',
      history: 'Historia',
      clear: 'Limpiar',
      repeat: 'Repetir',
      copy: 'Copiar',
      total: 'Total',
      results: 'Resultados',
      pool: 'Conjunto',
    },
    modes: {
      roll: 'Tiradas',
      divination: 'Adivinación',
    },
  },
  ja: {
    welcome: {
      title: 'Dice Rollerへようこそ',
      subtitle: '言語を選択して開始してください',
      selectLanguage: '言語を選択',
      continue: '続ける',
    },
    dice: {
      d4: '正四面体（4面）',
      d6: '立方体（6面）',
      d8: '正八面体（8面）',
      d10: '正十面体（10面）',
      d12: '正十二面体（12面）',
      d20: '正二十面体（20面）',
    },
    ui: {
      menu: 'メニュー',
      diceLabel: 'ダイス',
      roll: 'ロール',
      throwOne: '一つ投げる',
      power: 'パワー',
      rolling: 'ロール中...',
      modifier: '修正値',
      history: '履歴',
      clear: 'クリア',
      repeat: '繰り返す',
      copy: 'コピー',
      total: '合計',
      results: '結果',
      pool: 'プール',
    },
    modes: {
      roll: 'ロール',
      divination: '占い',
    },
  },
};

export const getTranslations = (lang: Language): Translations => {
  return translations[lang] || translations.en;
};
