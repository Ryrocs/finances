import type { Locale } from '@/lib/types';

/** Small inline SVG flags (emoji flags don't render on Windows and there is no Catalan emoji). */
export function Flag({ locale, className = 'h-5 w-7' }: { locale: Locale; className?: string }) {
  if (locale === 'ca') {
    return (
      <svg viewBox="0 0 9 6" className={className} aria-hidden>
        <rect width="9" height="6" fill="#FCDD09" />
        {[0.667, 2, 3.333, 4.667].map((y) => (
          <rect key={y} y={y} width="9" height="0.667" fill="#DA121A" />
        ))}
      </svg>
    );
  }
  if (locale === 'es') {
    return (
      <svg viewBox="0 0 9 6" className={className} aria-hidden>
        <rect width="9" height="6" fill="#AA151B" />
        <rect y="1.5" width="9" height="3" fill="#F1BF00" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id="uk-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
