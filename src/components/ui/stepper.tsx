import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  className
}: StepperProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-between h-[36px] bg-[#F1F5F9] rounded-[8px] p-1 gap-2 select-none border border-transparent hover:border-[#E2E8F0] transition-colors",
        className
      )}
    >
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-7 h-7 flex items-center justify-center rounded-[6px] bg-white text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-none border border-[#E2E8F0]/80"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <span className="min-w-[24px] text-center text-[13px] font-bold text-[#0F172A]">
        {value}
      </span>

      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-7 h-7 flex items-center justify-center rounded-[6px] bg-white text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-none border border-[#E2E8F0]/80"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
