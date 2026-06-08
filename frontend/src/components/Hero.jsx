import { motion } from 'framer-motion';
import { REPO_URL } from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';
import { GitHub } from './Icons.jsx';
import LangSwitch from './LangSwitch.jsx';

function Mark() {
  // compact pulse-grid glyph — brand mark
  return (
    <span className="grid h-8 w-8 place-items-center rounded-md border border-line bg-panel">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 13h4l2-6 3 12 2.5-9 1.5 3H21" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function Hero({ environment = {}, variantCount = 0, supportedCount = 0, stats = [] }) {
  const { t } = useI18n();
  const env = environment;
  const fade = (d = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: d, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <header className="relative">
      {/* top bar — wordmark + source */}
      <div className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-display text-[15px] font-semibold tracking-tight text-fg">PulseGrid</span>
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-2 py-0.5 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse-soft" />
              <span className="font-mono text-[10px] text-muted">{t('nav.offlineMeasured')}</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <LangSwitch />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="tag transition-colors hover:border-line-strong hover:text-fg"
            >
              <GitHub width={13} height={13} />
              <span>{t('nav.source')}</span>
            </a>
          </div>
        </div>
      </div>

      {/* hero body */}
      <div className="mx-auto max-w-6xl px-6 pb-14 pt-16 md:pt-20">
        <motion.p {...fade(0)} className="eyebrow">
          {t('hero.eyebrow')}
        </motion.p>

        <motion.h1
          {...fade(0.06)}
          className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-fg md:text-6xl"
        >
          {t('hero.titleA')}{' '}
          <span className="text-pulse">{t('hero.titleB')}</span>
        </motion.h1>

        <motion.p {...fade(0.14)} className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted">
          {t('hero.subtitle')} <span className="text-fg">{t('hero.subtitleStrong')}</span>
        </motion.p>

        <motion.div {...fade(0.2)} className="mt-7 flex flex-wrap items-center gap-2">
          <span className="tag">
            <span className="text-fg">{supportedCount}</span>
            <span className="text-dim">{t('hero.profilesSupported', { total: variantCount })}</span>
          </span>
          <span className="tag">
            <span className="text-dim">{t('hero.host')}</span>
            <span className="text-fg">{env.cpu || '—'} · {env.cores ?? '—'} {t('hero.cores')} · {env.ramGb ?? '—'} GB</span>
          </span>
        </motion.div>

        {/* KPI cards */}
        <motion.div {...fade(0.28)} className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="card card-hover p-4">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold tracking-tight text-fg md:text-[2.1rem]">{s.value}</span>
                {s.sub && <span className="font-mono text-[11px] text-dim">{s.sub}</span>}
              </p>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-pulse/70" style={{ width: s.bar || '55%' }} />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </header>
  );
}
