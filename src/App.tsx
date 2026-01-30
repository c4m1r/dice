import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from './app/store';
import { RollActionsProvider } from './app/rollActions';
import { SidebarLeft } from './ui/SidebarLeft';
import { SidebarRight } from './ui/SidebarRight';
import { MenuDrawer } from './ui/MenuDrawer';
import { MobileDrawerButtons, Drawer } from './ui/MobileDrawers';
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer3DRef = useRef<Renderer3D | null>(null);
  const renderer2DRef = useRef<Renderer2D | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const autoRollRef = useRef(false);

  // Initialize renderers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
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
        renderer3DRef.current = new Renderer3D(canvas);
        renderer3DRef.current.setResultByPhysics(settings.resultByPhysics);
      } catch (error) {
        console.warn('Failed to initialize 3D renderer:', error);
        renderer3DRef.current = null;
      }
    }

    // Initialize 2D renderer
    if ((settings.view === '2d' || settings.reducedMotion) && !renderer3DRef.current) {
      renderer2DRef.current = new Renderer2D(canvas);
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

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

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
  }, [settings.view, settings.reducedMotion]);

  useEffect(() => {
    if (settings.reducedMotion && settings.view !== '2d') {
      updateSettings({ view: '2d' });
    }
  }, [settings.reducedMotion, settings.view, updateSettings]);

  // Update 3D settings
  useEffect(() => {
    if (renderer3DRef.current) {
      renderer3DRef.current.setResultByPhysics(settings.resultByPhysics);
    }
  }, [settings.resultByPhysics]);

  useEffect(() => {
    const { url, repeat } = resolveTableBackground(settings.tableBackground);
    if (renderer3DRef.current) {
      renderer3DRef.current.setTableTexture(url, repeat);
    }
    if (renderer2DRef.current) {
      renderer2DRef.current.setBackground(url);
    }
  }, [settings.tableBackground, settings.view, settings.reducedMotion]);

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
          poolForRoll = { d20: 4, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, modifier: 0 };
          break;
        case 'two-dice':
          poolForRoll = { d6: 2, d4: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
          break;
        case 'three-dice':
          poolForRoll = { d6: 3, d4: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
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
          
          renderer3DRef.current.addDie(
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
      d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0,
      [die]: 1,
      modifier: 0
    };

    const throwForce = settings.throwForce * (0.4 + 1.2 * power);
    const spinForce = settings.spinForce * (0.2 + 1.6 * power);

    performRoll(singlePool, { throwForce, spinForce, source: 'single' });
  }, [lastSelectedDie, performRoll, settings.spinForce, settings.throwForce]);

  useEffect(() => {
    if (!isInitialized || autoRollRef.current) return;
    autoRollRef.current = true;
    const die = lastSelectedDie || 'd20';
    const singlePool = {
      d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0,
      [die]: 1,
      modifier: 0
    };
    performRoll(singlePool, { source: 'single' });
  }, [isInitialized, lastSelectedDie, performRoll]);

  const rollActions = useMemo(() => ({
    rollPool: (customPool?: DicePool) => performRoll(customPool ?? pool),
    rollSingle: (power: number) => performSingleRoll(power)
  }), [performRoll, performSingleRoll, pool]);

  return (
    <RollActionsProvider actions={rollActions}>
      <div className="h-screen bg-gray-900 flex overflow-hidden">
        {/* Desktop Left Sidebar */}
        <div className="hidden min-[900px]:block w-80 transition-transform duration-300 translate-x-[-50%] hover:translate-x-0">
          <SidebarLeft />
        </div>

        {/* Mobile Drawer Buttons */}
        <MobileDrawerButtons />

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ touchAction: 'none' }}
          />
          
          {isRolling && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <div className="bg-gray-800 text-white px-6 py-3 rounded-lg">
                Бросаю кости...
              </div>
            </div>
          )}
          
          {!isInitialized && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center text-white">
              <div>Инициализация...</div>
            </div>
          )}
        </div>

        {/* Desktop Right Sidebar */}
        <div className="hidden min-[900px]:block w-80 transition-transform duration-300 translate-x-[50%] hover:translate-x-0">
          <SidebarRight />
        </div>

        {/* Mobile Drawers */}
        <Drawer isOpen={leftDrawerOpen} onClose={toggleLeftDrawer} side="left">
          <SidebarLeft />
        </Drawer>
        
        <Drawer isOpen={rightDrawerOpen} onClose={toggleRightDrawer} side="right">
          <SidebarRight />
        </Drawer>

        {/* Menu Drawer */}
        <MenuDrawer />
      </div>
    </RollActionsProvider>
  );
}

export default App;
