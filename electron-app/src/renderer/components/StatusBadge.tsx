type StatusType = 'idle' | 'recording' | 'transcribing' | 'processing' | 'error' | 'cancelled';
type StatusBadgeSize = 'sm' | 'md' | 'lg';

interface StatusBadgeProps {
  status: StatusType;
  size?: StatusBadgeSize;
}

const sizeClasses: Record<StatusBadgeSize, string> = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

const statusClasses: Record<StatusType, string> = {
  idle: 'bg-idle shadow-[0_0_0_4px_rgba(34,197,94,0.12)]',
  recording: 'bg-recording animate-pulse shadow-[0_0_0_4px_rgba(239,68,68,0.14)]',
  transcribing: 'bg-transcribing shadow-[0_0_0_4px_rgba(59,130,246,0.14)]',
  processing: 'bg-processing shadow-[0_0_0_4px_rgba(139,92,246,0.14)]',
  error: 'bg-error shadow-[0_0_0_4px_rgba(249,115,22,0.14)]',
  cancelled: 'bg-cancelled shadow-[0_0_0_4px_rgba(107,114,128,0.14)]',
};

function joinClasses(...classes: string[]) {
  return classes.join(' ');
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      aria-label={`${status} status`}
      className={joinClasses(
        'inline-flex rounded-full border border-white/70 ring-1 ring-slate-950/5',
        sizeClasses[size],
        statusClasses[status],
      )}
    />
  );
}
