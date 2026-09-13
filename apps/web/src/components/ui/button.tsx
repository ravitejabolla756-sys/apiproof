import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-sans font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-xs active:scale-[0.99]',
    secondary: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 active:scale-[0.99]',
    outline: 'bg-transparent hover:bg-zinc-900 text-zinc-300 border border-zinc-800',
    ghost: 'bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200',
    danger: 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-sm px-4 py-2.5 gap-2.5',
  };

  return (
    <button
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
