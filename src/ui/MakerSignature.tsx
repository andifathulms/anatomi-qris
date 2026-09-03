import { useCopy } from '../copy';
import './maker-signature.css';

/**
 * The maker's mark. Personal credit, not a legal notice — it keeps its own
 * quiet line at the foot of the document and never borrows the authority of
 * the offline guarantee or the spec citations.
 *
 * Everything identifying lives in the two constants below.
 */

const MAKER = {
  name: 'Andi Fathul Mukminin',
  portfolio: 'https://andifathulms.github.io/en/',
};

interface MakerLink {
  label: string;
  href: string;
  icon: JSX.Element;
}

const LINKS: MakerLink[] = [
  {
    label: 'Portfolio',
    href: MAKER.portfolio,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
      </>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/andifathulms',
    icon: (
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2c2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2a4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6c-.6.6-.6 1.2-.5 2V21" />
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/andifathulmukminin/',
    icon: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/andifathulms/',
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </>
    ),
  },
];

export function MakerSignature() {
  const { t } = useCopy();
  const year = new Date().getFullYear();

  return (
    <div className="maker">
      <p className="maker__line">
        {t('maker.by')}{' '}
        <a
          className="maker__name"
          href={MAKER.portfolio}
          target="_blank"
          rel="noopener noreferrer"
        >
          {MAKER.name}
        </a>
        <span className="maker__sep" aria-hidden="true">·</span>
        <span className="maker__year">© {year}</span>
      </p>

      <ul className="maker__links">
        {LINKS.map((link) => (
          <li key={link.label}>
            <a
              className="maker__icon"
              href={link.href}
              aria-label={link.label}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                {link.icon}
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
