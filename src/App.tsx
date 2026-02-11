import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from './app/store';
import { RollActionsProvider } from './app/rollActions';
import { SidebarLeft } from './ui/SidebarLeft';
import { SidebarRight } from './ui/SidebarRight';
import { MenuDrawer } from './ui/MenuDrawer';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { Renderer3D } from './renderers/renderer3d';
import { Renderer2D } from './renderers/renderer2d';
import {
  rollPool as rollDicePool,
  calculateTotal,
  generateRollId,
  getDiceInPool,
  getTotalDiceCount
} from './engine/diceEngine';
import { performDivination } from './engine/divination';
import * as THREE from 'three';
import { DicePool, DieResult, DieType } from './app/types';
import { resolveTableBackground } from './app/backgrounds';

function App() {
  const {
    pool,
    settings,
    leftDrawerOpen,
    rightDrawerOpen,
    toggleLeftDrawer,
    toggleRightDrawer,
    isRolling,
    setIsRolling,
    addToHistory,
    lastSelectedDie,
    updateSettings
  } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderer3DRef = useRef<Renderer3D | null>(null);
  const renderer2DRef = useRef<Renderer2D | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize renderers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cleanup old renderers
    if (renderer3DRef.current) {
      renderer3DRef.current.dispose();
      renderer3DRef.current = null;
    }
    if (renderer2DRef.current) {
      renderer2DRef.current.dispose();
      renderer2DRef.current = null;
    }

    // Reset canvas - critical for switching between WebGL and 2D context
    const parent = canvas.parentElement;
    const newCanvas = canvas.cloneNode() as HTMLCanvasElement;
    parent?.replaceChild(newCanvas, canvas);
    canvasRef.current = newCanvas;

    const resizeCanvas = () => {
      const rect = newCanvas.getBoundingClientRect();
      newCanvas.width = rect.width;
      newCanvas.height = rect.height;

      if (renderer3DRef.current) {
        renderer3DRef.current.resize(rect.width, rect.height);
      }
      if (renderer2DRef.current) {
        renderer2DRef.current.resize(rect.width, rect.height);
      }
    };

    // Initialize 3D renderer
    if (settings.view === '3d' && !settings.reducedMotion) {
      try {
        renderer3DRef.current = new Renderer3D(newCanvas);
        renderer3DRef.current.setResultByPhysics(settings.resultByPhysics);
      } catch (error) {
        console.warn('Failed to initialize 3D renderer:', error);
        renderer3DRef.current = null;
        // Fallback to 2D
        renderer2DRef.current = new Renderer2D(newCanvas);
      }
    } else {
      // Initialize 2D renderer for 2D mode or reduced motion
      renderer2DRef.current = new Renderer2D(newCanvas);
    }

    const { url, repeat } = resolveTableBackground(settings.tableBackground);
    if (renderer3DRef.current) {
      renderer3DRef.current.setTableTexture(url, repeat);
    }
    if (renderer2DRef.current) {
      renderer2DRef.current.setBackground(url);
    }

    resizeCanvas();
    setIsInitialized(true);

    const observerTarget = parent || document.body;
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(observerTarget);

    return () => {
      resizeObserver.disconnect();
      if (renderer3DRef.current) {
        renderer3DRef.current.dispose();
        renderer3DRef.current = null;
      }
      if (renderer2DRef.current) {
        renderer2DRef.current.dispose();
        renderer2DRef.current = null;
      }
    };
  }, [settings.view, settings.reducedMotion, settings.resultByPhysics]);

  useEffect(() => {
    if (settings.reducedMotion && settings.view !== '2d') {
      updateSettings({ view: '2d' });
    }
  }, [settings.reducedMotion, settings.view, updateSettings]);

  // Update table background
  useEffect(() => {
    const { url, repeat } = resolveTableBackground(settings.tableBackground);
    if (renderer3DRef.current) {
      renderer3DRef.current.setTableTexture(url, repeat);
    }
    if (renderer2DRef.current) {
      renderer2DRef.current.setBackground(url);
    }
  }, [settings.tableBackground]);

  // Update dice color
  useEffect(() => {
    if (renderer3DRef.current) {
      renderer3DRef.current.setDiceColor(settings.diceColor);
    }
  }, [settings.diceColor]);


  // Emergency timeout for stuck rolling state
  useEffect(() => {
    if (!isRolling) return;

    const emergencyTimeout = setTimeout(() => {
      console.error('⚠️ ОШИБКА: Бросок завис более 15 секунд! Сброс состояния...');
      alert('⚠️ Ошибка: Бросок завис. Сбрасываю состояние.');
      setIsRolling(false);
    }, 15000);

    return () => clearTimeout(emergencyTimeout);
  }, [isRolling]);

  const performRoll = useCallback((
    customPool: DicePool = pool,
    overrides?: { throwForce?: number; spinForce?: number; source?: 'single' | 'pool' }
  ) => {
    setIsRolling(true);

    // Prepare divination pools
    let poolForRoll = customPool;
    if (settings.mode === 'divination' && overrides?.source !== 'single') {
      poolForRoll = { ...pool, modifier: 0 };

      switch (settings.divinationSubMode) {
        case 'one-die':
          poolForRoll = { d20: 4, d2: 0, d4: 0, d5: 0, d6: 0, d8: 0, d10: 0, d12: 0, modifier: 0 };
          break;
        case 'two-dice':
          poolForRoll = { d6: 2, d2: 0, d4: 0, d5: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
          break;
        case 'three-dice':
          poolForRoll = { d6: 3, d2: 0, d4: 0, d5: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
          break;
      }
    }

    const totalDice = getTotalDiceCount(poolForRoll);
    if (totalDice === 0) {
      alert('Добавьте кости в пул для броска!');
      setIsRolling(false);
      return;
    }

    if (totalDice > settings.maxDiceOnTable) {
      alert(`Слишком много костей! Максимум: ${settings.maxDiceOnTable}`);
      setIsRolling(false);
      return;
    }

    const preResults = rollDicePool(poolForRoll);

    // Handle rendering
    const activeRenderer = (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion)
      ? renderer3DRef.current
      : renderer2DRef.current;

    if (!activeRenderer) {
      setIsRolling(false);
      return;
    }

    const isPhysicsResult = settings.view === '3d'
      && renderer3DRef.current
      && !settings.reducedMotion
      && settings.resultByPhysics;

    const onSettled = (renderedResults?: DieResult[]) => {
      const finalResults = isPhysicsResult && renderedResults ? renderedResults : preResults;
      const finalTotal = calculateTotal(finalResults, poolForRoll.modifier);

      let interpretationText: string | undefined;

      if (settings.mode === 'divination') {
        const values = finalResults.map(r => r.value);
        interpretationText = performDivination(settings.divinationSubMode, values);
      }

      const event = {
        id: generateRollId(),
        timestamp: Date.now(),
        mode: settings.mode as 'roll' | 'divination',
        view: settings.view,
        subMode: settings.mode === 'divination' ? settings.divinationSubMode : undefined,
        pool: poolForRoll,
        results: finalResults,
        total: finalTotal,
        interpretationText
      };

      addToHistory(event);
      setIsRolling(false);
    };

    if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
      // 3D Roll
      renderer3DRef.current.clearDice();

      const diceList = getDiceInPool(poolForRoll);
      let index = 0;
      const usedResults = new Set<number>();

      const takePrerollValue = (type: DieType): number | undefined => {
        const resultIndex = preResults.findIndex((result, idx) => result.type === type && !usedResults.has(idx));
        if (resultIndex === -1) return undefined;
        usedResults.add(resultIndex);
        return preResults[resultIndex].value;
      };

      diceList.forEach(({ type, count }) => {
        for (let i = 0; i < count; i++) {
          const angle = (index / totalDice) * Math.PI * 2;
          const radius = 2 + Math.random() * 2;
          const position = new THREE.Vector3(
            Math.cos(angle) * radius,
            5 + Math.random() * 2,
            Math.sin(angle) * radius
          );

          const prerollValue = !settings.resultByPhysics ? takePrerollValue(type) : undefined;

          renderer3DRef.current!.addDie(
            type,
            position,
            overrides?.throwForce ?? settings.throwForce,
            overrides?.spinForce ?? settings.spinForce,
            prerollValue
          );
          index++;
        }
      });

      renderer3DRef.current.onSettled(onSettled);
    } else if (renderer2DRef.current) {
      // 2D Roll
      const diceForRender = preResults.map(result => ({
        type: result.type,
        value: result.value
      }));

      renderer2DRef.current.roll(diceForRender);
      renderer2DRef.current.onSettled(onSettled);
    }
  }, [
    pool,
    settings,
    setIsRolling,
    addToHistory
  ]);

  const performSingleRoll = useCallback((power: number) => {
    const die = lastSelectedDie || 'd20';
    const singlePool = {
      d2: 0, d4: 0, d5: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0,
      [die]: 1,
      modifier: 0
    };

    const throwForce = settings.throwForce * (0.4 + 1.2 * power);
    const spinForce = settings.spinForce * (0.2 + 1.6 * power);

    performRoll(singlePool, { throwForce, spinForce, source: 'single' });
  }, [lastSelectedDie, performRoll, settings.spinForce, settings.throwForce]);

  const performRandomizer = useCallback(() => {
    setIsRolling(true);
    const maxValue = settings.randomizerMax || 100;
    const randomNumber = Math.floor(Math.random() * maxValue) + 1;

    const activeRenderer = (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion)
      ? renderer3DRef.current
      : renderer2DRef.current;

    if (!activeRenderer) {
      setIsRolling(false);
      return;
    }

    const onSettled = () => {
      const event = {
        id: generateRollId(),
        timestamp: Date.now(),
        mode: 'randomizer' as 'roll' | 'divination',
        view: settings.view,
        pool: { d2: 0, d4: 0, d5: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 },
        results: [{ type: 'd20' as DieType, value: randomNumber }],
        total: randomNumber
      };

      addToHistory(event);
      setIsRolling(false);
    };

    if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
      renderer3DRef.current.onSettled(onSettled);
      renderer3DRef.current.showRandomNumber(randomNumber);
    } else if (renderer2DRef.current) {
      renderer2DRef.current.onSettled(onSettled);
      renderer2DRef.current.showRandomNumber(randomNumber);
    }
  }, [settings, addToHistory, setIsRolling]);

  const performDrawStraws = useCallback(() => {
    setIsRolling(true);
    const count = settings.strawsCount || 6;

    const activeRenderer = (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion)
      ? renderer3DRef.current
      : renderer2DRef.current;

    if (!activeRenderer) {
      setIsRolling(false);
      return;
    }

    const onSettled = (results: DieResult[]) => {
      const event = {
        id: generateRollId(),
        timestamp: Date.now(),
        mode: 'draw-straws' as 'roll' | 'divination',
        view: settings.view,
        pool: { d2: 0, d4: 0, d5: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 },
        results,
        total: results.reduce((sum, r) => sum + r.value, 0)
      };

      addToHistory(event);
      setIsRolling(false);
    };

    if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
      renderer3DRef.current.onSettled(onSettled);
      renderer3DRef.current.showDrawStraws(count);
    } else if (renderer2DRef.current) {
      renderer2DRef.current.onSettled(onSettled);
      renderer2DRef.current.showDrawStraws(count);
    }
  }, [settings, addToHistory, setIsRolling]);

  // Автоматический бросок при запуске отключён

  const rollActions = useMemo(() => ({
    rollPool: (customPool?: DicePool) => performRoll(customPool ?? pool),
    rollSingle: (power: number) => performSingleRoll(power)
  }), [performRoll, performSingleRoll, pool]);

  // Swipe gestures
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = touchEndTime - touchStartTime;

      // Ignore if too slow or too short
      if (deltaTime > 300 || Math.abs(deltaX) < 50) return;

      // Ignore if too vertical
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      // Swipe from left edge to open left menu
      if (touchStartX < 50 && deltaX > 80 && !leftDrawerOpen) {
        toggleLeftDrawer();
      }
      // Swipe from right edge to open right menu
      else if (touchStartX > window.innerWidth - 50 && deltaX < -80 && !rightDrawerOpen) {
        toggleRightDrawer();
      }
      // Swipe right to close left menu
      else if (leftDrawerOpen && deltaX > 80) {
        toggleLeftDrawer();
      }
      // Swipe left to close right menu
      else if (rightDrawerOpen && deltaX < -80) {
        toggleRightDrawer();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [leftDrawerOpen, rightDrawerOpen, toggleLeftDrawer, toggleRightDrawer]);

  return (
    <RollActionsProvider actions={rollActions}>
      <WelcomeScreen />
      <div className="h-screen bg-gray-900 overflow-hidden relative">
        {/* Canvas - Always fullscreen */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
        />



        {/* Left Sidebar - Always overlay */}
        <div className={`absolute left-0 top-0 bottom-0 bg-gray-900/60 backdrop-blur-md border-r border-white/10 text-white transition-transform duration-300 z-40 shadow-2xl w-80 ${leftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          <button
            onClick={toggleLeftDrawer}
            className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors z-50"
            aria-label="Закрыть панель"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <SidebarLeft />
        </div>

        {/* Right Sidebar - Always overlay */}
        <div className={`absolute right-0 top-0 bottom-0 bg-gray-900/60 backdrop-blur-md border-l border-white/10 text-white transition-transform duration-300 z-40 shadow-2xl w-80 ${rightDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
          <button
            onClick={toggleRightDrawer}
            className="absolute top-2 left-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors z-50"
            aria-label="Закрыть панель"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <SidebarRight />
        </div>

        {/* Left menu button */}
        {!leftDrawerOpen && (
          <button
            onClick={toggleLeftDrawer}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-35 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-r-lg shadow-lg text-white backdrop-blur-sm"
            aria-label="Открыть панель управления"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        )}

        {/* Right menu button */}
        {!rightDrawerOpen && (
          <button
            onClick={toggleRightDrawer}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-35 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-l-lg shadow-lg text-white backdrop-blur-sm"
            aria-label="Открыть историю"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}

        {/* Rolling message */}
        {isRolling && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none z-20">
            <div className="bg-gray-800/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg">
              Бросаю кости...
            </div>
          </div>
        )}

        {/* Initialization message */}
        {!isInitialized && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center text-white z-10">
            <div>Инициализация...</div>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <button
            disabled={isRolling || (settings.mode === 'roll' && getTotalDiceCount(pool) === 0)}
            onClick={() => {
              if (settings.mode === 'randomizer') {
                performRandomizer();
              } else if (settings.mode === 'draw-straws') {
                performDrawStraws();
              } else {
                performRoll();
              }
            }}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-xl font-bold transition-colors active:scale-95 text-white shadow-lg"
          >
            {isRolling ? 'Бросаю...' : settings.mode === 'randomizer' ? 'ГЕНЕРИРОВАТЬ' : settings.mode === 'draw-straws' ? 'ТЯНУТЬ ЖРЕБИЙ' : 'БРОСИТЬ'}
          </button>

          {/* Manual roll button - only in roll/divination modes */}
          {(settings.mode === 'roll' || settings.mode === 'divination') && (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (isRolling) return;

                // Check constraints
                const currentCount = renderer3DRef.current?.getDiceCount() ?? getTotalDiceCount(pool);
                if (currentCount >= settings.maxDiceOnTable) {
                  alert(`Максимум костей: ${settings.maxDiceOnTable}`);
                  return;
                }

                setIsRolling(true);
                const die = lastSelectedDie || 'd20';

                if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
                  renderer3DRef.current.spawnSuspendedDie(die);
                }

                const startTime = Date.now();

                const handlePointerUp = () => {
                  const holdTime = Date.now() - startTime;
                  const power = Math.min(holdTime / 1500, 1);

                  if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
                    renderer3DRef.current.onSettled((results) => {
                      const finalTotal = calculateTotal(results, pool.modifier);

                      // Reconstruct pool from results
                      const newPool: DicePool = {
                        d2: 0, d4: 0, d5: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0,
                        modifier: pool.modifier
                      };

                      results.forEach(r => {
                        if (typeof newPool[r.type] === 'number') {
                          newPool[r.type]++;
                        }
                      });

                      const event = {
                        id: generateRollId(),
                        timestamp: Date.now(),
                        mode: settings.mode as 'roll' | 'divination',
                        view: settings.view,
                        subMode: 'manual',
                        pool: newPool,
                        results,
                        total: finalTotal
                      };
                      addToHistory(event);
                      setIsRolling(false);
                    });

                    const throwForce = settings.throwForce * (0.4 + 1.2 * power);
                    const spinForce = settings.spinForce;
                    renderer3DRef.current.releaseSuspendedDice(throwForce, spinForce);
                  } else {
                    // Fallback for 2D 
                    performSingleRoll(power);
                  }

                  document.removeEventListener('pointerup', handlePointerUp);
                  document.removeEventListener('pointercancel', handlePointerUp);
                };

                document.addEventListener('pointerup', handlePointerUp);
                document.addEventListener('pointercancel', handlePointerUp);
              }}
              disabled={isRolling}
              className="w-16 h-16 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 rounded-lg transition-colors active:scale-95 text-white shadow-lg flex items-center justify-center"
              title="Кинуть одну (удерживайте для силы)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>

        {/* Menu Drawer */}
        <MenuDrawer />
      </div>
    </RollActionsProvider>
  );
}

export default App;
