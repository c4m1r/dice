import { DicePool, DieType, DieResult } from '../app/types';

export const getDiceInPool = (pool: DicePool): { type: DieType; count: number }[] => {
  return Object.entries(pool)
    .filter(([key, count]) => key !== 'modifier' && count > 0)
    .map(([type, count]) => ({ type: type as DieType, count: count as number }));
};

export const getTotalDiceCount = (pool: DicePool): number => {
  return Object.entries(pool)
    .filter(([key]) => key !== 'modifier')
    .reduce((total, [, count]) => total + (count as number), 0);
};

export const rollDie = (type: DieType): number => {
  const sides = parseInt(type.substring(1));
  return Math.floor(Math.random() * sides) + 1;
};

export const rollPool = (pool: DicePool): DieResult[] => {
  const results: DieResult[] = [];
  
  Object.entries(pool).forEach(([dieType, count]) => {
    if (dieType === 'modifier') return;
    
    for (let i = 0; i < count; i++) {
      results.push({
        type: dieType as DieType,
        value: rollDie(dieType as DieType)
      });
    }
  });
  
  return results;
};

export const calculateTotal = (results: DieResult[], modifier: number): number => {
  const sum = results.reduce((total, result) => total + result.value, 0);
  return sum + modifier;
};

export const formatPool = (pool: DicePool): string => {
  const dice = getDiceInPool(pool);
  let result = dice.map(d => `${d.count}${d.type}`).join(' + ');
  
  if (pool.modifier > 0) {
    result += ` + ${pool.modifier}`;
  } else if (pool.modifier < 0) {
    result += ` - ${Math.abs(pool.modifier)}`;
  }
  
  return result || '0';
};

export const formatResults = (results: DieResult[]): string => {
  return results.map(r => `${r.type}:${r.value}`).join(', ');
};

export const getDieSides = (type: DieType): number => {
  return parseInt(type.substring(1));
};

export const generateRollId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};