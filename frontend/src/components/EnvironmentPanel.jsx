import { useI18n } from '../lib/i18n.jsx';

export default function EnvironmentPanel({ environment = {}, generatedAt, limitsRange = null }) {
  const { t } = useI18n();
  const limits = environment.containerLimits || {};
  const baseline = `${limits.cpus} CPU · ${limits.memory}${limits.cpuset ? ` · cpuset ${limits.cpuset}` : ''}`;
  // [stableId, translatedLabel, value] — styling keys off the stable id, not the label.
  const rows = [
    ['cpu', t('env.k.cpu'), environment.cpu],
    ['cores', t('env.k.cores'), environment.cores],
    ['ram', t('env.k.ram'), environment.ramGb != null ? `${environment.ramGb} GB` : null],
    ['os', t('env.k.os'), environment.os],
    ['java', t('env.k.java'), environment.java],
    ['graalvm', t('env.k.graalvm'), environment.graalvm || '—'],
    ['springBoot', t('env.k.springBoot'), environment.springBoot],
    ['quarkus', t('env.k.quarkus'), environment.quarkus],
    ['resourceLimits', t('env.k.resourceLimits'),
      limitsRange ? t('env.v.swept', { range: limitsRange.label }) : baseline],
    ['sweepBaseline', t('env.k.sweepBaseline'),
      limitsRange ? t('env.v.envelopes', { count: limitsRange.count, baseline }) : null],
  ].filter((r) => r[2] != null);

  return (
    <div>
      <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-muted">
        {t('env.intro1')}<span className="font-mono text-[13px] text-fg">docker stats</span>{t('env.intro2')}
      </p>
      <dl className="card grid grid-cols-1 gap-x-12 px-5 py-1 sm:grid-cols-2">
        {rows.map(([id, label, v]) => (
          <div key={id} className="flex items-baseline justify-between gap-6 border-b border-line/60 py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0">
            <dt className="font-mono text-[11px] uppercase tracking-label text-dim">{label}</dt>
            <dd className={`stat truncate text-right text-[13px] ${id === 'resourceLimits' ? 'text-pulse' : 'text-fg'}`} title={String(v)}>
              {String(v)}
            </dd>
          </div>
        ))}
      </dl>
      {generatedAt && (
        <p className="mt-5 font-mono text-[11px] uppercase tracking-label text-dim">
          {t('env.measured', { date: generatedAt })}
        </p>
      )}
    </div>
  );
}
