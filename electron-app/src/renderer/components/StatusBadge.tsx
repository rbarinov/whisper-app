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
  idle: 'bg-idle shadow-[0_0_0_6px_rgba(22,153,118,0.11)]',
  recording: 'bg-recording animate-pulse shadow-[0_0_0_6px_rgba(232,93,80,0.12)]',
  transcribing: 'bg-transcribing shadow-[0_0_0_6px_rgba(70,117,216,0.12)]',
  processing: 'bg-processing shadow-[0_0_0_6px_rgba(195,139,54,0.12)]',
  error: 'bg-error shadow-[0_0_0_6px_rgba(217,119,69,0.12)]',
  cancelled: 'bg-cancelled shadow-[0_0_0_6px_rgba(122,129,125,0.12)]',
};

function joinClasses(...classes: string[]) {
  return classes.join(' ');
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      aria-label={`${status} status`}
      className={joinClasses(
        'inline-flex rounded-full border border-white/75 ring-1 ring-[#15231e]/5',
        sizeClasses[size],
        statusClasses[status],
      )}
    />
  );
}
