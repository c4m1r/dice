import { useRef, useEffect, useState } from 'react';
import { useAppStore } from './app/store';
import { SidebarLeft } from './ui/SidebarLeft';
import { SidebarRight } from './ui/SidebarRight';
import { MenuDrawer } from './ui/MenuDrawer';
import { MobileDrawerButtons, Drawer } from './ui/MobileDrawers';
import { Renderer3D } from './renderers/renderer3d';
import { Renderer2D } from './renderers/renderer2d';
import { 
  rollPool, 
  calculateTotal, 
  generateRollId,
  getDiceInPool,
  getTotalDiceCount 
} from './engine/diceEngine';
import { performDivination } from './engine/divination';
import * as THREE from 'three';

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
    lastSelectedDie
  } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer3DRef = useRef<Renderer3D | null>(null);
  const renderer2DRef = useRef<Renderer2D | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Update 3D settings
  useEffect(() => {
    if (renderer3DRef.current) {
      renderer3DRef.current.setResultByPhysics(settings.resultByPhysics);
    }
  }, [settings.resultByPhysics]);

  const performRoll = (customPool = pool) => {
    const totalDice = getTotalDiceCount(customPool);
    
    if (totalDice === 0) {
      alert('Добавьте кости в пул для броска!');
      return;
    }

    if (totalDice > settings.maxDiceOnTable) {
      alert(`Слишком много костей! Максимум: ${settings.maxDiceOnTable}`);
      return;
    }

    setIsRolling(true);

    // Prepare divination pools
    let rollPool = customPool;
    if (settings.mode === 'divination') {
      rollPool = { ...pool, modifier: 0 };
      
      switch (settings.divinationSubMode) {
        case 'one-die':
          rollPool = { d20: 4, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, modifier: 0 };
          break;
        case 'two-dice':
          rollPool = { d6: 2, d4: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
          break;
        case 'three-dice':
          rollPool = { d6: 3, d4: 0, d8: 0, d10: 0, d12: 0, d20: 0, modifier: 0 };
          break;
      }
    }

    const results = rollPool(rollPool);
    const total = calculateTotal(results, rollPool.modifier);

    // Handle rendering
    const activeRenderer = (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) 
      ? renderer3DRef.current 
      : renderer2DRef.current;

    if (!activeRenderer) {
      setIsRolling(false);
      return;
    }

    const onSettled = (renderedResults?: any) => {
      let interpretationText: string | undefined;
      
      if (settings.mode === 'divination') {
        const values = results.map(r => r.value);
        interpretationText = performDivination(settings.divinationSubMode, values);
      }

      const event = {
        id: generateRollId(),
        timestamp: Date.now(),
        mode: settings.mode as 'roll' | 'divination',
        view: settings.view,
        subMode: settings.mode === 'divination' ? settings.divinationSubMode : undefined,
        pool: rollPool,
        results,
        total,
        interpretationText
      };

      addToHistory(event);
      setIsRolling(false);
    };

    if (settings.view === '3d' && renderer3DRef.current && !settings.reducedMotion) {
      // 3D Roll
      renderer3DRef.current.clearDice();
      
      const diceList = getDiceInPool(rollPool);
      let index = 0;
      
      diceList.forEach(({ type, count }) => {
        for (let i = 0; i < count; i++) {
          const angle = (index / totalDice) * Math.PI * 2;
          const radius = 2 + Math.random() * 2;
          const position = new THREE.Vector3(
            Math.cos(angle) * radius,
            5 + Math.random() * 2,
            Math.sin(angle) * radius
          );
          
          const prerollValue = results.find(r => r.type === type && !r.used)?.value;
          if (prerollValue !== undefined) {
            const result = results.find(r => r.type === type && !r.used);
            if (result) result.used = true;
          }
          
          renderer3DRef.current.addDie(
            type, 
            position, 
            settings.throwForce, 
            settings.spinForce,
            prerollValue
          );
          index++;
        }
      });

      renderer3DRef.current.onSettled(onSettled);
    } else if (renderer2DRef.current) {
      // 2D Roll
      const diceForRender = results.map(result => ({
        type: result.type,
        value: result.value
      }));
      
      renderer2DRef.current.roll(diceForRender);
      renderer2DRef.current.onSettled(onSettled);
    }
  };

  const performSingleRoll = (power: number) => {
    const die = lastSelectedDie || 'd20';
    const singlePool = {
      d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0,
      [die]: 1,
      modifier: 0
    };

    performRoll(singlePool);
  };

  return (
    <div className="h-screen bg-gray-900 flex overflow-hidden">
      {/* Desktop Left Sidebar */}
      <div className="hidden lg:block">
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
      <div className="hidden lg:block">
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

      {/* Roll Button Click Handler */}
      <div 
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 lg:hidden"
        onClick={() => performRoll()}
      >
        <button 
          disabled={isRolling || getTotalDiceCount(pool) === 0}
          className="bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg text-xl font-bold transition-colors active:scale-95 shadow-lg"
        >
          {isRolling ? 'Бросаю...' : 'БРОСИТЬ'}
        </button>
      </div>
    </div>
  );
}

export default App;