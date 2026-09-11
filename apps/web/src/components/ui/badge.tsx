import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'healthy' | 'affected' | 'warning' | 'info' | 'neutral' | 'outline' | 'destructive' | 'success';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variants = {
    healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    affected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    destructive: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    neutral: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
    outline: 'bg-transparent text-zinc-400 border-zinc-700/60',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

