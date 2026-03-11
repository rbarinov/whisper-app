import { APP_LEGAL_NOTICE, APP_REPOSITORY_URL } from '../../shared/version';

interface LegalNoticeProps {
  className?: string;
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function LegalNotice({ className }: LegalNoticeProps) {
  return (
    <section className={joinClasses('section-card px-4 py-3.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="hero-kicker">Legal</p>
        <a
          href={APP_REPOSITORY_URL}
          title="Open GitHub repository"
          aria-label="Open GitHub repository"
          className={[
            'inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#15231e]/10',
            'bg-white/80 text-[#4b5650] shadow-[0_10px_24px_rgba(44,54,49,0.08)] backdrop-blur-md transition-all duration-200',
            'hover:-translate-y-0.5 hover:border-[#15231e]/18 hover:bg-white hover:text-[#16211b] hover:shadow-[0_14px_30px_rgba(44,54,49,0.12)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          ].join(' ')}
          onClick={(event) => {
            event.preventDefault();
            void window.api.openExternalUrl(APP_REPOSITORY_URL);
          }}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 5h10v10" />
            <path d="M19 5 8 16" />
            <path d="M15 13v6H5V9h6" />
          </svg>
        </a>
      </div>
      <p className="mt-1.5 text-sm leading-5 text-[#4b5650]">{APP_LEGAL_NOTICE}</p>
    </section>
  );
}
