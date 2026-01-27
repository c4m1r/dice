import { useState, useRef } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { useAppStore } from '../app/store';
import { formatPool, formatResults } from '../engine/diceEngine';

export const SidebarRight: React.FC = () => {
  const { history, clearHistory } = useAppStore();
  const [holdPower, setHoldPower] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartRef = useRef<number>(0);

  const startHold = () => {
    setIsHolding(true);
    holdStartRef.current = Date.now();
    
    const updatePower = () => {
      if (isHolding) {
        const elapsed = Date.now() - holdStartRef.current;
        const power = Math.min(elapsed / 1500, 1);
        setHoldPower(power);
        holdTimerRef.current = requestAnimationFrame(updatePower);
      }
    };
    
    updatePower();
  };

  const endHold = () => {
    setIsHolding(false);
    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
    }
    
    // TODO: Trigger single die roll with holdPower
    console.log('Rolling with power:', holdPower);
    
    setTimeout(() => setHoldPower(0), 200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const repeatRoll = (event: any) => {
    // TODO: Implement repeat roll
    console.log('Repeating roll:', event);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="w-80 bg-gray-800 text-white p-4 flex flex-col h-full">
      {/* Throw One Button */}
      <div className="mb-4">
        <button
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          className={`w-full py-3 rounded-lg text-lg font-bold transition-all relative overflow-hidden ${
            isHolding ? 'bg-red-500' : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-red-400 transition-all duration-75"
            style={{ width: `${holdPower * 100}%` }}
          />
          <span className="relative z-10">
            {isHolding ? `Сила: ${Math.round(holdPower * 100)}%` : 'Кинуть одну'}
          </span>
        </button>
      </div>

      {/* History */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">История</h2>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-white"
            >
              Очистить
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3">
          {history.length === 0 ? (
            <p className="text-gray-400 text-center py-8">История пуста</p>
          ) : (
            history.map((event) => (
              <div key={event.id} className="bg-gray-700 rounded p-3 text-sm">
                {/* Header */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">{formatTime(event.timestamp)}</span>
                  <div className="flex gap-1 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      event.mode === 'roll' ? 'bg-purple-600' : 'bg-orange-600'
                    }`}>
                      {event.mode === 'roll' ? 'Бросок' : 'Гадание'}
                    </span>
                    <span className="px-2 py-1 bg-blue-600 rounded">
                      {event.view.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {/* Pool and Results */}
                <div className="mb-2">
                  <div className="text-gray-300">Пул: {formatPool(event.pool)}</div>
                  <div>Результаты: {formatResults(event.results)}</div>
                  <div className="font-bold">Итого: {event.total}</div>
                </div>
                
                {/* Interpretation */}
                {event.interpretationText && (
                  <div className="mb-2 p-2 bg-gray-600 rounded italic text-xs">
                    {event.interpretationText}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => repeatRoll(event)}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-500 transition-colors"
                  >
                    <RotateCcw size={12} />
                    Повторить
                  </button>
                  <button
                    onClick={() => copyToClipboard(`${formatPool(event.pool)} = ${event.total}`)}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500 transition-colors"
                  >
                    <Copy size={12} />
                    Копировать
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};