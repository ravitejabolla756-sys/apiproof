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
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/10 active:scale-[0.98]',
    secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60',
    outline: 'bg-transparent hover:bg-zinc-800/60 text-zinc-300 border border-zinc-700/80',
    ghost: 'bg-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
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
