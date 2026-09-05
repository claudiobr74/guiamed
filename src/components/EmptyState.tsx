import { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center bg-white rounded-[10px] border border-[#E2E8F0]", className)}>
      <div className="w-10 h-10 flex items-center justify-center rounded-[8px] bg-[#EFF6FF] text-[#1E5FA6] mb-3">
        {icon}
      </div>
      <h3 className="text-[14px] font-bold text-[#0F172A] mb-1">{title}</h3>
      <p className="text-[13px] text-[#475569] mb-4 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
