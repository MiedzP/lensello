'use client';

import { ReactNode, useState } from 'react';

interface TooltipProps {
  children: ReactNode;
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({
  children,
  label,
  side = 'top',
  delay = 200,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setShow(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setShow(false);
  };

  const positionClasses = {
    top: 'bottom-full mb-2 -translate-x-1/2 left-1/2',
    bottom: 'top-full mt-2 -translate-x-1/2 left-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full -mt-1 -translate-x-1/2 left-1/2 border-t-4 border-l-4 border-r-4 border-l-transparent border-r-transparent border-t-slate-800',
    bottom: 'bottom-full -mb-1 -translate-x-1/2 left-1/2 border-b-4 border-l-4 border-r-4 border-l-transparent border-r-transparent border-b-slate-800',
    left: 'left-full -ml-1 top-1/2 -translate-y-1/2 border-l-4 border-t-4 border-b-4 border-t-transparent border-b-transparent border-l-slate-800',
    right: 'right-full -mr-1 top-1/2 -translate-y-1/2 border-r-4 border-t-4 border-b-4 border-t-transparent border-b-transparent border-r-slate-800',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {show && (
        <div
          className={`absolute px-2 py-1 text-xs font-medium text-white bg-slate-800 rounded whitespace-nowrap pointer-events-none z-50 ${positionClasses[side]}`}
        >
          {label}
          <div className={`absolute w-0 h-0 ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  );
}

export function TooltipIcon({
  icon: Icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors ${className}`}
      >
        <Icon size={16} />
      </button>
    </Tooltip>
  );
}
