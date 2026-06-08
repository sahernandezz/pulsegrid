import { motion } from 'framer-motion';
import {
  codeLink, PARADIGM_META, PACKAGING_META, STACK_META,
  fmtInt, fmtMs, fmtDuration, fmtMb, fmtDec, fmtPct,
} from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';
import Badge from './Badge.jsx';
import { Close, ExternalLink } from './Icons.jsx';

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <h4 className="mb-2 font-mono text-[11px] font-medium uppercase tracking-label text-dim">{title}</h4>
      <div className="rounded-card border border-line bg-panel-2/50 px-4">{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/50 py-2.5 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="stat text-right text-[13px] text-fg">{value}</span>
    </div>
  );
}

function withRuns(obj, fmt) {
  if (!obj || obj.median == null) return '—';
  const base = fmt(obj.median);
  if (Array.isArray(obj.runs) && obj.runs.length) {
    return `${base}  ·  σ ${obj.stddev ?? 0}  ·  [${obj.runs.join(', ')}]`;
  }
  return base;
}

export default function VariantDrawer({ variant, onClose }) {
  const { t, tMeta, localizedNote } = useI18n();
  if (!variant) return null;
  const v = variant;
  const title = [
    STACK_META[v.stack]?.label || v.stack,
    tMeta(PARADIGM_META[v.paradigm]?.label),
    tMeta(PACKAGING_META[v.packaging]?.label),
  ]
    .filter(Boolean)
    .join(' · ');
  const m = v.metrics;
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-pop md:p-8"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 34, stiffness: 300 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge>{STACK_META[v.stack]?.label || v.stack}</Badge>
              <Badge tone={PARADIGM_META[v.paradigm]?.tone}>{tMeta(PARADIGM_META[v.paradigm]?.label)}</Badge>
              <Badge tone={PACKAGING_META[v.packaging]?.tone}>{tMeta(PACKAGING_META[v.packaging]?.label)}</Badge>
              <Badge tone="muted">{t('drawer.ingest', { mode: v.ingestMode })}</Badge>
            </div>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-fg">{title}</h3>
            <p className="mt-1 font-mono text-xs text-dim">{v.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('drawer.closePanel')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <Close />
          </button>
        </div>

        <a href={codeLink(v)} target="_blank" rel="noreferrer"
           className="mt-5 inline-flex items-center gap-2 rounded-md border border-pulse/35 bg-pulse/10 px-3 py-2 font-mono text-xs text-pulse transition-colors hover:bg-pulse/20">
          <ExternalLink width={14} height={14} />
          {t('drawer.viewSource')}
        </a>

        {!v.supported || !m ? (
          <Section title={t('drawer.notSupportedTitle')}>
            <p className="py-3 text-sm leading-relaxed text-muted">{localizedNote(v) || t('drawer.noMetrics')}</p>
          </Section>
        ) : (
          <>
            <Section title={t('drawer.sec.throughputLatency')}>
              <Field label={t('drawer.f.throughput')} value={withRuns(m.throughputRps, fmtInt)} />
              <Field label="p50" value={fmtMs(m.latencyMs?.p50)} />
              <Field label="p95" value={fmtMs(m.latencyMs?.p95)} />
              <Field label="p99" value={fmtMs(m.latencyMs?.p99)} />
              <Field label="p99.9" value={fmtMs(m.latencyMs?.p999)} />
              <Field label={t('drawer.f.errorRate')} value={fmtPct(m.errorRatePct?.median)} />
            </Section>

            <Section title={t('drawer.sec.startup')}>
              <Field label={t('drawer.f.coldStart')} value={withRuns(m.startupMs, fmtDuration)} />
              <Field label={t('drawer.f.timeToFirst')} value={fmtDuration(m.timeToFirstReqMs?.median)} />
              <Field label={t('drawer.f.warmup')} value={fmtDuration(m.warmupToStableMs?.median)} />
            </Section>

            <Section title={t('drawer.sec.memoryCpu')}>
              <Field label={t('drawer.f.idleRss')} value={withRuns(m.idleRssMb, fmtMb)} />
              <Field label={t('drawer.f.underLoadRss')} value={fmtMb(m.underLoadRssMb?.median)} />
              <Field label={t('drawer.f.underLoadCpu')} value={fmtPct(m.underLoadCpuPct?.median)} />
            </Section>

            <Section title={t('drawer.sec.footprint')}>
              <Field label={t('drawer.f.imageSize')} value={fmtMb(m.imageSizeMb?.value)} />
              <Field label={t('drawer.f.rpsPerMb')} value={fmtDec(m.efficiency?.rpsPerMb)} />
              <Field label={t('drawer.f.rpsPerCpu')} value={fmtDec(m.efficiency?.rpsPerCpuPct)} />
            </Section>
          </>
        )}
      </motion.aside>
    </>
  );
}
