import { X, Settings, BookOpen, Info } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../app/store';

const diceDescriptions = {
  'd4': 'четырёхгранник (тетраэдр): компактная кость для небольших значений; результат читается по верхней зоне/вершине; шутливо "самая опасная".',
  'd6': 'шестигранник (куб): универсальная кость; из-за неё все кости часто зовут "кубиками".',
  'd8': 'восьмигранник (октаэдр): для эффектов средней силы; результат по верхней грани.',
  'd10': 'десятигранник: 1–10 или 0–9; две d10 часто как d100; 0 при одиночном броске обычно = 10.',
  'd12': 'двенадцатигранник (додекаэдр): широкий диапазон без хаоса d20.',
  'd20': 'двадцатигранник (икосаэдр): равномерное распределение, критические исходы встречаются чаще.'
};

export const MenuDrawer: React.FC = () => {
  const { menuDrawerOpen, toggleMenuDrawer, settings, updateSettings, clearHistory } = useAppStore();
  const [currentPage, setCurrentPage] = useState<'menu' | 'settings' | 'encyclopedia' | 'about'>('menu');

  if (!menuDrawerOpen) return null;

  const renderMenu = () => (
    <div className="space-y-4">
      <button
        onClick={() => setCurrentPage('settings')}
        className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-700 rounded"
      >
        <Settings size={20} />
        Настройки
      </button>
      <button
        onClick={() => setCurrentPage('encyclopedia')}
        className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-700 rounded"
      >
        <BookOpen size={20} />
        Энциклопедия
      </button>
      <button
        onClick={() => setCurrentPage('about')}
        className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-700 rounded"
      >
        <Info size={20} />
        О приложении
      </button>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <button
        onClick={() => setCurrentPage('menu')}
        className="text-blue-400 hover:text-blue-300"
      >
        ← Назад к меню
      </button>
      
      <div>
        <h3 className="font-bold mb-3">3D Настройки</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Сила броска: {settings.throwForce}</label>
            <input
              type="range"
              min="5"
              max="50"
              value={settings.throwForce}
              onChange={(e) => updateSettings({ throwForce: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-1">Сила вращения: {settings.spinForce}</label>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.spinForce}
              onChange={(e) => updateSettings({ spinForce: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-1">Макс. костей на столе: {settings.maxDiceOnTable}</label>
            <input
              type="range"
              min="6"
              max="24"
              value={settings.maxDiceOnTable}
              onChange={(e) => updateSettings({ maxDiceOnTable: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="physicsResult"
              checked={settings.resultByPhysics}
              onChange={(e) => updateSettings({ resultByPhysics: e.target.checked })}
            />
            <label htmlFor="physicsResult" className="text-sm">
              Результат по физике (экспериментально)
            </label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="reducedMotion"
              checked={settings.reducedMotion}
              onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
            />
            <label htmlFor="reducedMotion" className="text-sm">
              Упрощённые анимации
            </label>
          </div>
        </div>
      </div>
      
      <div>
        <button
          onClick={clearHistory}
          className="w-full p-3 bg-red-600 hover:bg-red-500 rounded"
        >
          Очистить историю
        </button>
      </div>
    </div>
  );

  const renderEncyclopedia = () => (
    <div className="space-y-6">
      <button
        onClick={() => setCurrentPage('menu')}
        className="text-blue-400 hover:text-blue-300"
      >
        ← Назад к меню
      </button>
      
      <div>
        <h3 className="font-bold mb-4">Кости</h3>
        <div className="space-y-3 text-sm">
          {Object.entries(diceDescriptions).map(([die, description]) => (
            <div key={die}>
              <span className="font-mono font-bold text-blue-300">{die.toUpperCase()}</span> — {description}
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="font-bold mb-4">Гадания</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-bold text-orange-300">На одной кости (4 броска)</h4>
            <p>Интерпретация по паттерну чёт/нечёт (X/O). Пример: XXOO - равновесие сил.</p>
          </div>
          <div>
            <h4 className="font-bold text-orange-300">На двух костях</h4>
            <p>Трактовка по сумме (2-12). Сумма 7 - счастливое число, удача в начинаниях.</p>
          </div>
          <div>
            <h4 className="font-bold text-orange-300">На трёх костях</h4>
            <p>Трактовка по сумме (3-18). Более глубокая интерпретация жизненных ситуаций.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-6">
      <button
        onClick={() => setCurrentPage('menu')}
        className="text-blue-400 hover:text-blue-300"
      >
        ← Назад к меню
      </button>
      
      <div>
        <h3 className="font-bold mb-4">DnD Dice Roller</h3>
        <div className="space-y-3 text-sm">
          <p>
            Приложение для броска игральных костей с поддержкой 2D и 3D режимов.
            Оптимизировано для мобильных устройств.
          </p>
          <p>
            Поддерживает стандартные кости для настольных ролевых игр: d4, d6, d8, d10, d12, d20.
          </p>
          <p>
            Включает режимы обычных бросков и гаданий с интерпретацией результатов.
          </p>
          <div className="mt-4 pt-4 border-t border-gray-600">
            <p className="text-gray-400">
              Технологии: React, TypeScript, Three.js, Cannon-es
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      <div className="bg-gray-800 w-80 h-full p-4 text-white overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {currentPage === 'menu' && 'Меню'}
            {currentPage === 'settings' && 'Настройки'}
            {currentPage === 'encyclopedia' && 'Энциклопедия'}
            {currentPage === 'about' && 'О приложении'}
          </h2>
          <button
            onClick={toggleMenuDrawer}
            className="p-2 hover:bg-gray-700 rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        {currentPage === 'menu' && renderMenu()}
        {currentPage === 'settings' && renderSettings()}
        {currentPage === 'encyclopedia' && renderEncyclopedia()}
        {currentPage === 'about' && renderAbout()}
      </div>
      
      <div 
        className="flex-1"
        onClick={toggleMenuDrawer}
      />
    </div>
  );
};