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
  'inline-flex items-center justify-center rounded-full border font-semibold tracking-[0.01em] transition-all duration-200 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0f766e]/25 focus-visible:ring-offset-white',
  'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none',
].join(' ');

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-[12px]',
  md: 'min-h-11 px-5 text-sm',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'border-transparent bg-[#15231e] text-white shadow-[0_18px_36px_rgba(21,35,30,0.18)]',
    'hover:-translate-y-0.5 hover:bg-[#0f1a16] hover:shadow-[0_22px_40px_rgba(21,35,30,0.22)]',
    'active:bg-[#15231e]',
  ].join(' '),
  secondary: [
    'border-[rgba(22,33,27,0.1)] bg-white/80 text-[#1b2924] shadow-[0_12px_24px_rgba(44,54,49,0.08)] backdrop-blur-md',
    'hover:-translate-y-0.5 hover:border-[rgba(22,33,27,0.16)] hover:bg-white hover:shadow-[0_16px_30px_rgba(44,54,49,0.12)]',
    'active:bg-[#f4f2eb]',
  ].join(' '),
  danger: [
    'border-transparent bg-[#d35b4d] text-white shadow-[0_18px_34px_rgba(211,91,77,0.22)]',
    'hover:-translate-y-0.5 hover:bg-[#c65042] hover:shadow-[0_20px_38px_rgba(211,91,77,0.26)]',
    'active:bg-[#b94a3d]',
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
