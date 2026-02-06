import { useState, useRef } from 'react';
import { Info, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { useAppStore } from '../app/store';
import { DieType } from '../app/types';
import { getTotalDiceCount } from '../engine/diceEngine';
import { useRollActions } from '../app/rollActions';

const diceInfo: Record<DieType, { icon: any; name: string; description: string }> = {
  d4: { icon: Dice1, name: 'D4', description: 'Тетраэдр (4 грани)' },
  d6: { icon: Dice6, name: 'D6', description: 'Куб (6 граней)' },
  d8: { icon: Dice2, name: 'D8', description: 'Октаэдр (8 граней)' },
  d10: { icon: Dice3, name: 'D10', description: 'Десятигранник (10 граней)' },
  d12: { icon: Dice4, name: 'D12', description: 'Додекаэдр (12 граней)' },
  d20: { icon: Dice5, name: 'D20', description: 'Икосаэдр (20 граней)' },
};

export const SidebarLeft: React.FC = () => {
  const { 
    pool, 
    settings, 
    updatePool, 
    updateSettings, 
    toggleMenuDrawer,
    setLastSelectedDie,
    isRolling
  } = useAppStore();
  const { rollPool, rollSingle } = useRollActions();
  
  const [showTooltip, setShowTooltip] = useState<DieType | null>(null);
  const [modifierTipOpen, setModifierTipOpen] = useState(false);
  const [holdPower, setHoldPower] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);
  const holdingRef = useRef(false);

  const updateDieCount = (type: DieType, delta: number) => {
    const currentCount = pool[type];
    const newCount = Math.max(0, Math.min(20, currentCount + delta));
    const totalAfter = getTotalDiceCount({ ...pool, [type]: newCount });
    if (delta > 0 && totalAfter > settings.maxDiceOnTable) {
      alert(`Слишком много костей! Максимум на столе: ${settings.maxDiceOnTable}`);
      return;
    }
    updatePool({ [type]: newCount });
    if (newCount > 0) {
      setLastSelectedDie(type);
    }
  };

  const updateModifier = (delta: number) => {
    const newModifier = Math.max(-10, Math.min(10, pool.modifier + delta));
    updatePool({ modifier: newModifier });
  };

  const startHold = () => {
    if (isRolling) return;
    setIsHolding(true);
    holdingRef.current = true;
    holdStartRef.current = Date.now();
    
    const updatePower = () => {
      if (holdingRef.current) {
        const elapsed = Date.now() - holdStartRef.current;
        const power = Math.min(elapsed / 1500, 1);
        setHoldPower(power);
        holdTimerRef.current = requestAnimationFrame(updatePower);
      }
    };
    
    updatePower();
  };

  const endHold = () => {
    if (!holdingRef.current) return;
    setIsHolding(false);
    holdingRef.current = false;
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
    }
    
    const holdMs = Date.now() - holdStartRef.current;
    const power = Math.max(0, Math.min(holdMs / 1500, 1));
    rollSingle(power);
    
    setTimeout(() => setHoldPower(0), 200);
  };

  return (
    <div className="w-80 bg-gray-800 text-white p-4 flex flex-col h-full">
      {/* Menu Button */}
      <button
        onClick={toggleMenuDrawer}
        className="flex items-center gap-2 w-full p-3 bg-gray-700 rounded-lg hover:bg-gray-600 mb-4 transition-colors"
      >
        <span className="text-lg">☰</span>
        Меню
      </button>

      {/* Dice Pool */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3">Кости</h2>
        <div className="space-y-2">
          {Object.entries(diceInfo).map(([type, info]) => {
            const IconComponent = info.icon;
            const count = pool[type as DieType];
            
            return (
              <div key={type} className="flex items-center gap-3 p-2 bg-gray-700 rounded">
                <div className="relative">
                  <IconComponent size={20} />
                  <button
                    type="button"
                    onPointerEnter={() => setShowTooltip(type as DieType)}
                    onPointerLeave={() => setShowTooltip(null)}
                    onClick={() => setShowTooltip(showTooltip === type ? null : (type as DieType))}
                    className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-gray-900 text-[10px] flex items-center justify-center"
                    aria-label="Информация"
                  >
                    <Info size={10} />
                  </button>
                  {showTooltip === type && (
                    <div className="absolute left-full ml-2 top-0 bg-gray-900 text-xs p-2 rounded whitespace-nowrap z-10">
                      {info.description}
                    </div>
                  )}
                </div>
                
                <span className="w-8 text-sm font-mono">{info.name}</span>
                
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => updateDieCount(type as DieType, -1)}
                    disabled={count === 0}
                    className="w-8 h-8 bg-red-600 rounded text-lg font-bold hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  
                  <span className="w-8 text-center font-mono">{count}</span>
                  
                  <button
                    onClick={() => updateDieCount(type as DieType, 1)}
                    disabled={count >= 20}
                    className="w-8 h-8 bg-green-600 rounded text-lg font-bold hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode Toggles */}
      <div className="mb-6">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => updateSettings({ view: '2d' })}
            className={`flex-1 py-2 px-3 rounded transition-colors ${
              settings.view === '2d' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => updateSettings({ view: '3d' })}
            className={`flex-1 py-2 px-3 rounded transition-colors ${
              settings.view === '3d' ? 'bg-blue-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            3D
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ mode: 'roll' })}
            className={`flex-1 py-2 px-3 rounded transition-colors ${
              settings.mode === 'roll' ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            Броски
          </button>
          <button
            onClick={() => updateSettings({ mode: 'divination' })}
            className={`flex-1 py-2 px-3 rounded transition-colors ${
              settings.mode === 'divination' ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'
            }`}
          >
            Гадания
          </button>
        </div>
      </div>

      {/* Divination Sub-modes */}
      {settings.mode === 'divination' && (
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-2">Тип гадания</h3>
          <select
            value={settings.divinationSubMode}
            onChange={(e) => updateSettings({ divinationSubMode: e.target.value as any })}
            className="w-full p-2 bg-gray-700 rounded"
          >
            <option value="one-die">На одной кости (4 броска)</option>
            <option value="two-dice">На двух костях</option>
            <option value="three-dice">На трёх костях</option>
          </select>
        </div>
      )}

      {/* Modifier */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold">Модификатор</h3>
          <button
            type="button"
            onPointerEnter={() => setModifierTipOpen(true)}
            onPointerLeave={() => setModifierTipOpen(false)}
            onClick={() => setModifierTipOpen(!modifierTipOpen)}
            className="relative w-5 h-5 rounded-full bg-gray-700 text-xs flex items-center justify-center"
            aria-label="Что делает модификатор"
          >
            <Info size={12} />
            {modifierTipOpen && (
              <span className="absolute left-full ml-2 top-0 bg-gray-900 text-xs p-2 rounded w-48 text-left z-10">
                Добавляет или вычитает значение из общей суммы броска.
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateModifier(-1)}
            disabled={pool.modifier <= -10}
            className="w-8 h-8 bg-red-600 rounded font-bold hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            −
          </button>
          
          <span className="flex-1 text-center font-mono text-lg">
            {pool.modifier >= 0 ? '+' : ''}{pool.modifier}
          </span>
          
          <button
            onClick={() => updateModifier(1)}
            disabled={pool.modifier >= 10}
            className="w-8 h-8 bg-green-600 rounded font-bold hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            +
          </button>
        </div>
      </div>

    </div>
  );
};
