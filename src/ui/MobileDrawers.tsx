import { Menu, History } from 'lucide-react';
import { useAppStore } from '../app/store';

export const MobileDrawerButtons: React.FC = () => {
  const { toggleLeftDrawer, toggleRightDrawer } = useAppStore();

  return (
    <div className="min-[900px]:hidden fixed top-4 left-4 right-4 flex justify-center gap-3 z-40 pointer-events-none">
      <button
        onClick={toggleLeftDrawer}
        className="bg-gray-800 text-white p-3 rounded-lg shadow-lg hover:bg-gray-700 transition-colors pointer-events-auto"
      >
        <Menu size={20} />
      </button>
      <button
        onClick={toggleRightDrawer}
        className="bg-gray-800 text-white p-3 rounded-lg shadow-lg hover:bg-gray-700 transition-colors pointer-events-auto"
      >
        <History size={20} />
      </button>
    </div>
  );
};

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, side, children }) => {
  if (!isOpen) return null;

  return (
    <div className="min-[900px]:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      <div
        className={`bg-gray-800 w-80 h-full ${
          side === 'right' ? 'ml-auto' : ''
        } transform transition-transform duration-300`}
      >
        {children}
      </div>
      
      <div 
        className="flex-1"
        onClick={onClose}
      />
    </div>
  );
};
