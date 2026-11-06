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
  const base = 'inline-flex min-h-10 items-center justify-center font-sans font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#111111] hover:bg-zinc-800 text-white shadow-sm active:scale-[0.99]',
    secondary: 'bg-white hover:bg-zinc-50 text-[#111111] border border-[#E8E8E5] shadow-xs active:scale-[0.99]',
    outline: 'bg-white hover:bg-zinc-50 text-[#111111] border border-[#E8E8E5] shadow-xs',
    ghost: 'bg-transparent hover:bg-zinc-100 text-[#686868] hover:text-[#111111]',
    danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-2 gap-1.5',
    md: 'text-xs sm:text-sm px-4.5 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-6 py-3.5 gap-2.5',
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
