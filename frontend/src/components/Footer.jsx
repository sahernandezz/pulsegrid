import { REPO_URL } from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';
import { GitHub } from './Icons.jsx';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-[13px] leading-relaxed text-muted">
          {t('footer.text1')}
          <span className="font-mono text-[12px] text-fg">consolidated-results.json</span>
          {t('footer.text2')}
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="tag transition-colors hover:border-line-strong hover:text-fg"
        >
          <GitHub width={13} height={13} />
          <span>{t('footer.source')}</span>
        </a>
      </div>
    </footer>
  );
}
