import type { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

const baseClasses = [
  'inline-flex items-center justify-center rounded-full border font-medium tracking-[0.02em] transition-all duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-950/20',
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none',
].join(' ');

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-5 text-sm',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]',
    'hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-[0_14px_32px_rgba(15,23,42,0.24)]',
    'active:bg-slate-950',
  ].join(' '),
  secondary: [
    'border-slate-300 bg-white/90 text-slate-900 shadow-[0_8px_18px_rgba(148,163,184,0.18)] backdrop-blur-sm',
    'hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-[0_12px_24px_rgba(148,163,184,0.22)]',
    'active:bg-slate-50',
  ].join(' '),
  danger: [
    'border-red-600 bg-red-500 text-white shadow-[0_10px_24px_rgba(239,68,68,0.24)]',
    'hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-[0_14px_32px_rgba(239,68,68,0.3)]',
    'active:bg-red-700',
  ].join(' '),
};

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={joinClasses(baseClasses, sizeClasses[size], variantClasses[variant], className)}
    >
      {children}
    </button>
  );
}
