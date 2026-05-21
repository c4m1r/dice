import React from 'react';

interface PowerMeterProps {
  level: number; // 0 to 1
}

const PowerMeter: React.FC<PowerMeterProps> = ({ level }) => {
  const percentage = Math.round(level * 100);
  
  // Calculate SVG stroke offset for radial progress
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - level * circumference;

  // Determine color based on power level (green -> yellow -> red)
  const getColor = (val: number) => {
    if (val < 0.4) return 'rgb(34, 197, 94)'; // Green (tailwind-like green-500)
    if (val < 0.75) return 'rgb(234, 179, 8)'; // Yellow (tailwind-like yellow-500)
    return 'rgb(239, 68, 68)'; // Red (tailwind-like red-500)
  };

  const currentColor = getColor(level);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-fade-in">
      <div 
        className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gray-900/80 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300 scale-100"
        style={{
          boxShadow: `0 0 30px ${currentColor}20`,
        }}
      >
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Radial progress circle */}
          <svg className="w-full h-full transform -rotate-90">
            {/* Background track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Glowing progress line */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={currentColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: 'stroke-dashoffset 0.05s linear, stroke 0.2s ease',
                filter: `drop-shadow(0 0 6px ${currentColor})`
              }}
            />
          </svg>
          
          {/* Central percentage text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span 
              className="text-4xl font-extrabold tracking-tight transition-colors duration-200"
              style={{ color: currentColor, textShadow: `0 0 10px ${currentColor}30` }}
            >
              {percentage}%
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-400 mt-1 font-semibold">
              Сила
            </span>
          </div>
        </div>

        {/* Instructive subtitle */}
        <div className="mt-4 text-sm font-medium text-gray-300 text-center animate-pulse">
          Отпустите для броска
        </div>
      </div>
    </div>
  );
};

export default PowerMeter;
