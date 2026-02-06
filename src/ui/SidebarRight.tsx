import { useState, useEffect } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { useAppStore } from '../app/store';
import { RollEvent } from '../app/types';
import { formatPool, formatResults } from '../engine/diceEngine';
import { useRollActions } from '../app/rollActions';

export const SidebarRight: React.FC = () => {
  const { history, clearHistory, updateSettings, settings } = useAppStore();
  const { rollPool } = useRollActions();
  const [showWarning, setShowWarning] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const repeatRoll = (event: RollEvent) => {
    updateSettings({
      mode: event.mode,
      view: event.view,
      divinationSubMode: (event.subMode as 'one-die' | 'two-dice' | 'three-dice') || settings.divinationSubMode
    });
    rollPool(event.pool);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleClearHistory = () => {
    const lastWarningTime = localStorage.getItem('lastClearWarning');
    const now = Date.now();
    
    // Показываем предупреждение если прошло больше часа
    if (!lastWarningTime || now - parseInt(lastWarningTime) > 3600000) {
      setShowWarning(true);
      localStorage.setItem('lastClearWarning', now.toString());
      
      setTimeout(() => {
        setShowWarning(false);
      }, 5000);
    } else {
      clearHistory();
    }
  };

  return (
    <div className="w-80 bg-gray-800 text-white p-4 flex flex-col h-full">
      {/* History */}
      <div className="flex-1 flex flex-col">
        <div className="relative mb-3">
          <h2 className="text-lg font-bold text-center">История</h2>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
            >
              Очистить
            </button>
          )}
        </div>
        
        {/* Warning popup */}
        {showWarning && (
          <div className="mb-3 bg-yellow-600/20 border border-yellow-600/50 rounded p-3 text-xs text-yellow-200">
            Если ты уверен то очищай, но помни DND мастер спалит тебя по истории, слабый и жалкий читер
          </div>
        )}
        
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
                      {event.mode === 'roll' ? 'Броски' : 'Гадания'}
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
                  {event.pool.modifier !== 0 && (
                    <div className="text-gray-300">Модификатор: {event.pool.modifier >= 0 ? '+' : ''}{event.pool.modifier}</div>
                  )}
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
