import type { ReactNode } from 'react';

interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  className?: string;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function IconButton({
  icon,
  onClick,
  title,
  disabled = false,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={joinClasses(
        'inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700',
        'shadow-[0_10px_24px_rgba(148,163,184,0.18)] backdrop-blur-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 hover:shadow-[0_14px_32px_rgba(148,163,184,0.24)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 focus-visible:ring-offset-2',
        'active:scale-[0.97] active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none',
        className,
      )}
    >
      {icon}
    </button>
  );
}
