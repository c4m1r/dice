import { createContext, useContext } from 'react';
import { DicePool } from './types';

export type RollActions = {
  rollPool: (pool?: DicePool) => void;
  rollSingle: (power: number) => void;
};

const RollActionsContext = createContext<RollActions | null>(null);

export const RollActionsProvider: React.FC<{
  actions: RollActions;
  children: React.ReactNode;
}> = ({ actions, children }) => (
  <RollActionsContext.Provider value={actions}>
    {children}
  </RollActionsContext.Provider>
);

export const useRollActions = (): RollActions => {
  const context = useContext(RollActionsContext);
  if (!context) {
    throw new Error('useRollActions must be used within RollActionsProvider');
  }
  return context;
};
