import { AUTHOR, REPO_URL } from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';
import { GitHub, LinkedIn, ExternalLink } from './Icons.jsx';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">
            {t('footer.text1')}
            <span className="font-mono text-[12px] text-fg">consolidated-results.json</span>
            {t('footer.text2')}
          </p>
          {/* author / creator credit — links the project back to its author */}
          <p className="text-[13px] text-dim">
            {t('footer.builtBy')}{' '}
            <a
              href={AUTHOR.portfolio}
              target="_blank"
              rel="noreferrer author"
              className="font-medium text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              {AUTHOR.name}
            </a>
            <span className="text-line"> · </span>
            <span className="font-mono text-[11px] text-dim">{AUTHOR.role}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={REPO_URL} target="_blank" rel="noreferrer"
             className="tag transition-colors hover:border-line-strong hover:text-fg">
            <GitHub width={13} height={13} />
            <span>{t('footer.source')}</span>
          </a>
          <a href={AUTHOR.linkedin} target="_blank" rel="noreferrer author"
             aria-label="LinkedIn — Sergio Hernández"
             className="tag transition-colors hover:border-line-strong hover:text-fg">
            <LinkedIn width={13} height={13} />
            <span>LinkedIn</span>
          </a>
          <a href={AUTHOR.portfolio} target="_blank" rel="noreferrer author"
             aria-label="Portfolio — Sergio Hernández"
             className="tag transition-colors hover:border-line-strong hover:text-fg">
            <ExternalLink width={13} height={13} />
            <span>{t('footer.portfolio')}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
