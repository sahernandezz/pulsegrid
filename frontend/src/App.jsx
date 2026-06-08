import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useConsolidated,
  useScaling,
  useScalingQueue,
  filterVariants,
  buildLimitVariants,
  limitsRange,
} from './lib/data.js';
import { useI18n } from './lib/i18n.jsx';
import Hero from './components/Hero.jsx';
import SampleBanner from './components/SampleBanner.jsx';
import Filters from './components/Filters.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import Charts from './components/Charts.jsx';
import ScalingSection from './components/ScalingSection.jsx';
import VariantDrawer from './components/VariantDrawer.jsx';
import EnvironmentPanel from './components/EnvironmentPanel.jsx';
import Footer from './components/Footer.jsx';

const uniq = (arr) => [...new Set(arr)];

function Center({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center font-mono text-sm text-muted">
      {children}
    </div>
  );
}

function Section({ index, kicker, title, children, aside }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">
            <span className="text-pulse">{index}</span>
            <span className="mx-2 text-line">/</span>
            {kicker}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg md:text-[1.75rem]">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

export default function App() {
  const { t } = useI18n();
  const { data, loading, error } = useConsolidated();
  const { data: scaling } = useScaling();
  const { data: scalingQueue } = useScalingQueue();
  const [filters, setFilters] = useState({ mode: 'http', stacks: [], paradigms: [], packagings: [] });
  const [limit, setLimit] = useState('2cpu-1g');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // queue gets all limits once its sweep data is present; until then, baseline only
  const queueLocked = filters.mode === 'queue' && !scalingQueue;
  const effectiveLimit = queueLocked ? '2cpu-1g' : limit;
  const curEnv = scaling?.envelopes.find((e) => e.label === effectiveLimit);
  const limitLabel = curEnv ? `${curEnv.cpus} CPU · ${curEnv.memory}` : '2 CPU · 1g';

  const options = useMemo(() => {
    const vs = data?.variants || [];
    return {
      stacks: uniq(vs.map((v) => v.stack)),
      paradigms: uniq(vs.map((v) => v.paradigm)),
      packagings: uniq(vs.map((v) => v.packaging)),
    };
  }, [data]);

  const baseVariants = useMemo(
    () => buildLimitVariants(scaling, scalingQueue, data, filters.mode, effectiveLimit),
    [scaling, scalingQueue, data, filters.mode, effectiveLimit],
  );

  const filtered = useMemo(() => {
    const list = filterVariants(baseVariants, filters);
    const score = (v) => (v.supported && v.metrics ? (v.metrics.throughputRps?.median ?? -1) : -2);
    return [...list].sort((a, b) => score(b) - score(a));
  }, [baseVariants, filters]);
  const supportedFiltered = filtered.filter((v) => v.supported && v.metrics);

  // headline stat cells (computed from the canonical run)
  const heroStats = useMemo(() => {
    const vs = data?.variants || [];
    const sup = (mode) => vs.filter((v) => v.ingestMode === mode && v.supported && v.metrics);
    const peak = (mode) => Math.max(0, ...sup(mode).map((v) => v.metrics.throughputRps?.median || 0));
    const nat = sup('http').filter((v) => v.packaging === 'native');
    const minRss = Math.min(Infinity, ...nat.map((v) => v.metrics.idleRssMb?.median ?? Infinity));
    const minStart = Math.min(Infinity, ...nat.map((v) => v.metrics.startupMs?.median ?? Infinity));
    const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`);
    const h = peak('http');
    const q = peak('queue');
    return [
      { label: t('kpi.peakHttp'), value: h ? k(h) : '—', sub: t('kpi.reqs'), bar: '70%' },
      { label: t('kpi.peakQueue'), value: q ? k(q) : '—', sub: t('kpi.reqs'), bar: '95%' },
      { label: t('kpi.nativeIdle'), value: isFinite(minRss) ? `${Math.round(minRss)}` : '—', sub: t('kpi.mbRam'), bar: '28%' },
      {
        label: t('kpi.nativeColdStart'),
        value: isFinite(minStart) ? (minStart < 1000 ? `${Math.round(minStart)}ms` : `${(minStart / 1000).toFixed(1)}s`) : '—',
        sub: t('kpi.dockerTo200'),
        bar: '20%',
      },
    ];
  }, [data, t]);

  if (loading) return <Center>{t('app.loading')}</Center>;
  if (error) return <Center>{t('app.loadError', { error })}</Center>;

  const total = data.variants.length;
  const supported = data.variants.filter((v) => v.supported).length;
  const range = limitsRange(scaling);

  return (
    <div className="min-h-full">
      {data.sample && <SampleBanner />}
      <Hero environment={data.environment} variantCount={total} supportedCount={supported} stats={heroStats} />

      <main className="mx-auto max-w-6xl space-y-24 overflow-x-clip px-6 py-20">
        <Section
          index="01"
          kicker={t('section.comparison')}
          title={t('section.variantMatrix')}
          aside={<span className="tag">{t('aside.shown', { n: supportedFiltered.length, limit: limitLabel, mode: filters.mode })}</span>}
        >
          <Filters filters={filters} setFilters={setFilters} options={options} />

          {/* resource-limit selector — drives the matrix + charts (http has all 4) */}
          {scaling && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] uppercase tracking-label text-dim">{t('matrix.limit')}</span>
              {scaling.envelopes.map((e) => {
                const active = effectiveLimit === e.label;
                const disabled = queueLocked && e.label !== '2cpu-1g';
                return (
                  <button
                    key={e.label}
                    disabled={disabled}
                    data-active={active}
                    onClick={() => setLimit(e.label)}
                    className="pill"
                  >
                    {e.cpus} CPU · {e.memory}
                  </button>
                );
              })}
              {queueLocked && (
                <span className="ml-1 font-mono text-[11px] text-warn">{t('matrix.queueBaselineOnly')}</span>
              )}
            </div>
          )}

          <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-muted">
            {filters.mode === 'queue' ? (
              <>
                <span className="text-warn">{t('matrix.queue.lead')}</span>
                {t('matrix.queue.mid')}
                <span className="text-fg">{t('matrix.queue.accept')}</span>
                {t('matrix.queue.measuredAt')}
                <span className="text-fg">{limitLabel}</span>
                {t('matrix.queue.ranked')}
                <span className="text-fg">{t('matrix.queue.withinOnly')}</span>
                {t('matrix.queue.tail')}
              </>
            ) : (
              <>
                <span className="text-pulse">{t('matrix.http.lead')}</span>
                {t('matrix.http.mid')}
                <span className="text-fg">{limitLabel}</span>
                {t('matrix.http.switch')}
                <span className="text-fg">{t('matrix.http.limitWord')}</span>
                {t('matrix.http.rerank')}
                <span className="text-fg">{t('matrix.http.section')}</span>
                {t('matrix.http.tail')}
              </>
            )}
          </p>
          <div className="mt-6">
            <ComparisonTable variants={filtered} onSelect={setSelected} />
          </div>
        </Section>

        <Section
          index="02"
          kicker={t('section.diagrams')}
          title={t('section.atGlance')}
          aside={<span className="tag">{t('aside.limitMode', { limit: limitLabel, mode: filters.mode })}</span>}
        >
          <Charts variants={supportedFiltered} />
        </Section>

        {scaling && (
          <Section
            index="03"
            kicker={t('section.resourceScaling')}
            title={t('section.underPressure')}
            aside={<span className="tag">{t('aside.envelopes', { n: scaling.envelopes.length })}</span>}
          >
            <ScalingSection scaling={scaling} />
          </Section>
        )}

        <Section index="04" kicker={t('section.methodology')} title={t('section.whereItRan')}>
          <EnvironmentPanel environment={data.environment} generatedAt={data.generatedAt} limitsRange={range} />
        </Section>
      </main>

      <Footer />

      <AnimatePresence>
        {selected && <VariantDrawer variant={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
