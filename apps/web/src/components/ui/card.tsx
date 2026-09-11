import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', id, onClick }: CardProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-[#12141c] border border-[#1f2333] rounded-xl p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-zinc-700 hover:bg-[#161924]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pb-4 mb-4 border-b border-[#1f2333] ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-base font-semibold text-zinc-100 flex items-center gap-2 ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

