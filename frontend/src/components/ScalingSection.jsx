import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PARADIGM_META,
  SCALING_METRICS,
  STACK_META,
  scalingDomain,
  scalingGroups,
} from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';

const PULSE = '#2dd4bf'; // native
const SIGNAL = '#7c9bf5'; // jvm
const GRID = '#1b212b';
const AXIS = '#7d8794';
const FG = '#e6e9ef';
const mono = '"IBM Plex Mono", monospace';

const variantLabel = (v, tMeta) =>
  `${tMeta(PARADIGM_META[v.paradigm]?.short || v.paradigm)} ${v.packaging === 'native' ? 'native' : 'jvm'}`;

function Btn({ active, onClick, children }) {
  return (
    <button data-active={active} onClick={onClick} className="pill">
      {children}
    </button>
  );
}

// ---- X tick for the trend lines: "N CPU" over its memory cap ----
function CpuTick({ x, y, payload, memByCpus }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill={FG} fontSize={11} fontFamily={mono} fontWeight={600}>
        {payload.value} CPU
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill={AXIS} fontSize={9} fontFamily={mono}>
        {memByCpus[payload.value]}
      </text>
    </g>
  );
}

function TrendTooltip({ active, payload, label, metric, memByCpus }) {
  if (!active || !payload?.length) return null;
  const nat = payload.find((p) => p.dataKey === 'native')?.value;
  const jvm = payload.find((p) => p.dataKey === 'jvm')?.value;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[11px] shadow-pop">
      <div className="mb-1 text-dim">{label} CPU · {memByCpus[label]}</div>
      {nat != null && <div className="flex justify-between gap-4"><span className="text-pulse">● native</span><span className="text-fg">{metric.fmt(nat)} {metric.unit}</span></div>}
      {jvm != null && <div className="flex justify-between gap-4"><span className="text-signal">┄ jvm</span><span className="text-fg">{metric.fmt(jvm)} {metric.unit}</span></div>}
    </div>
  );
}

// ---- Trend: one small-multiple line panel per paradigm (native vs jvm) ----
function TrendPanel({ group, metric, domain, envelopes, memByCpus, ceiling, cleanLast }) {
  const { t, tMeta } = useI18n();
  const stack = STACK_META[group.stack]?.label || group.stack;
  const para = tMeta(PARADIGM_META[group.paradigm]?.label || group.paradigm);
  const data = envelopes.map((e) => {
    const np = group.native?.points[e.label];
    const jp = group.jvm?.points[e.label];
    return {
      cpus: e.cpus,
      native: np && np.supported ? np[metric.key] : null,
      jvm: jp && jp.supported ? jp[metric.key] : null,
    };
  });
  const lead = (lab) => {
    const np = group.native?.points[lab];
    const jp = group.jvm?.points[lab];
    if (!np?.supported || !jp?.supported || np[metric.key] == null || jp[metric.key] == null) return null;
    return (metric.better === 'max' ? np[metric.key] > jp[metric.key] : np[metric.key] < jp[metric.key]) ? 'native' : 'jvm';
  };
  const a = lead(envelopes[0].label);
  const b = lead(cleanLast.label);
  const hasNative = data.some((d) => d.native != null);

  return (
    <div className="card min-w-0 overflow-hidden p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-fg">{para}</h3>
        <span className="font-mono text-[10.5px] uppercase tracking-label text-dim">{stack}</span>
      </div>
      <p className="mb-3 font-mono text-[11px] text-muted">
        {hasNative && a && b ? (
          a === b ? (
            <><span className={a === 'native' ? 'text-pulse' : 'text-signal'}>{a}</span>{t('scaling.leadsThrough4.suffix')}</>
          ) : (
            <><span className={a === 'native' ? 'text-pulse' : 'text-signal'}>{a}</span>{t('scaling.tightMid')}<span className={b === 'native' ? 'text-pulse' : 'text-signal'}>{b}</span>{t('scaling.roomyTail')}</>
          )
        ) : (
          <span className="text-warn">{t('scaling.nativeExcluded')}</span>
        )}
      </p>
      <div className="h-52 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="cpus" type="category" tick={<CpuTick memByCpus={memByCpus} />} stroke={GRID} tickLine={false} height={40} interval={0} />
            <YAxis domain={domain} width={42} stroke={GRID} tickLine={false} tick={{ fill: AXIS, fontSize: 10, fontFamily: mono }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            {ceiling != null && (
              <ReferenceLine y={ceiling} stroke={AXIS} strokeDasharray="3 4" strokeOpacity={0.5} label={{ value: t('scaling.dbCeiling'), position: 'insideTopRight', fill: AXIS, fontSize: 9, fontFamily: mono }} />
            )}
            <Tooltip cursor={{ stroke: GRID }} content={<TrendTooltip metric={metric} memByCpus={memByCpus} />} />
            <Line type="monotone" dataKey="jvm" stroke={SIGNAL} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: SIGNAL, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="native" stroke={PULSE} strokeWidth={2.5} dot={{ r: 3, fill: PULSE, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---- Per-limit: ranked horizontal bars for one envelope ----
function EnvelopeBars({ scaling, envelope, metric }) {
  const { t, tMeta } = useI18n();
  const metricLabel = t(`smetric.${metric.key}`);
  const data = scaling.variants
    .map((v) => {
      const p = v.points[envelope.label];
      return { label: variantLabel(v, tMeta), value: p?.supported ? p[metric.key] : null, native: v.packaging === 'native' };
    })
    .filter((d) => d.value != null)
    .sort((x, y) => (metric.better === 'max' ? y.value - x.value : x.value - y.value));

  return (
    <div className="card min-w-0 overflow-hidden p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold text-fg">
          {envelope.cpus} CPU <span className="text-dim">/</span> {envelope.memory}
        </h3>
        <span className="font-mono text-[10.5px] uppercase tracking-label text-dim">
          {t('scaling.bestWorst', { metric: metricLabel })}
        </span>
      </div>
      <div className="min-w-0" style={{ height: data.length * 38 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 0, right: 64, bottom: 0, left: 4 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" stroke={GRID} tickLine={false} tick={{ fill: AXIS, fontSize: 10, fontFamily: mono }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <YAxis type="category" dataKey="label" width={104} stroke={GRID} tickLine={false} tick={{ fill: FG, fontSize: 11, fontFamily: mono }} />
            <Tooltip cursor={{ fill: 'rgba(45,212,191,0.07)' }} contentStyle={{ background: '#0f131a', border: '1px solid #212833', borderRadius: 8, boxShadow: '0 18px 48px -16px rgba(0,0,0,0.8)', fontFamily: mono, fontSize: 12, color: '#e6e9ef' }} formatter={(v) => [`${metric.fmt(v)} ${metric.unit}`, metricLabel]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.native ? PULSE : SIGNAL} />)}
              <LabelList dataKey="value" position="right" formatter={(v) => metric.fmt(v)} style={{ fill: FG, fontFamily: mono, fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DataTable({ scaling, metric, envelopes, selected }) {
  const { t } = useI18n();
  const best = useMemo(() => {
    const m = {};
    for (const e of envelopes) {
      let win = null, val = null;
      for (const v of scaling.variants) {
        const p = v.points[e.label];
        if (!p?.supported || p[metric.key] == null) continue;
        if (val == null || (metric.better === 'max' ? p[metric.key] > val : p[metric.key] < val)) { val = p[metric.key]; win = v.id; }
      }
      m[e.label] = win;
    }
    return m;
  }, [scaling, metric, envelopes]);

  return (
    <div className="card mt-6 overflow-x-auto p-1">
      <table className="w-full border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-line text-dim">
            <th className="py-2.5 pl-3 pr-4 text-left font-medium uppercase tracking-label">{t('scaling.tableVariant')}</th>
            {envelopes.map((e) => (
              <th key={e.label} className={`px-3 py-2.5 text-right font-medium ${selected === e.label ? 'text-pulse' : ''}`}>
                {e.cpus} CPU<span className="text-dim"> / </span>{e.memory}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scaling.variants.map((v) => (
            <tr key={v.id} className="border-b border-line/60 last:border-0">
              <td className="py-2.5 pl-3 pr-4">
                <span className={v.packaging === 'native' ? 'text-pulse' : 'text-signal'}>{v.packaging === 'native' ? '●' : '┄'}</span>{' '}
                <span className="text-fg">{v.id}</span>
              </td>
              {envelopes.map((e) => {
                const p = v.points[e.label];
                const ok = p?.supported && p[metric.key] != null;
                const isBest = best[e.label] === v.id;
                const sel = selected === e.label;
                return (
                  <td key={e.label} className={`px-3 py-2.5 text-right tabular-nums ${sel ? 'bg-pulse/5' : ''} ${isBest ? 'font-semibold text-pulse' : ok ? 'text-fg' : 'text-danger'}`}>
                    {ok ? metric.fmt(p[metric.key]) : 'OOM'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScalingSection({ scaling }) {
  const { t } = useI18n();
  const [metricKey, setMetricKey] = useState('throughputRps');
  const [view, setView] = useState('trend'); // 'trend' | envelope.label
  const metric = SCALING_METRICS.find((m) => m.key === metricKey);
  const groups = useMemo(() => scalingGroups(scaling), [scaling]);
  const domain = useMemo(() => scalingDomain(scaling, metricKey), [scaling, metricKey]);
  const envelopes = scaling.envelopes;
  const memByCpus = useMemo(() => Object.fromEntries(envelopes.map((e) => [String(e.cpus), e.memory])), [envelopes]);
  const ceiling = metricKey === 'throughputRps' ? domain[1] * 0.97 : null;
  const cleanLast = useMemo(() => envelopes.filter((e) => e.cpus <= 4).slice(-1)[0] || envelopes[envelopes.length - 1], [envelopes]);
  const selectedEnv = envelopes.find((e) => e.label === view);

  return (
    <div>
      {/* resource-limit selector */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-label text-dim">{t('scaling.limit')}</span>
        <Btn active={view === 'trend'} onClick={() => setView('trend')}>{t('scaling.trend')}</Btn>
        {envelopes.map((e) => (
          <Btn key={e.label} active={view === e.label} onClick={() => setView(e.label)}>{e.cpus} CPU · {e.memory}</Btn>
        ))}
      </div>

      {/* metric toggle + legend */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {SCALING_METRICS.map((m) => (
            <Btn key={m.key} active={m.key === metricKey} onClick={() => setMetricKey(m.key)}>{t(`smetric.${m.key}`)}</Btn>
          ))}
        </div>
        <div className="flex items-center gap-5 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded bg-pulse" /> native</span>
          <span className="flex items-center gap-2"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-signal" /> jvm</span>
        </div>
      </div>

      {view === 'trend' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <TrendPanel key={g.key} group={g} metric={metric} domain={domain} envelopes={envelopes} memByCpus={memByCpus} ceiling={ceiling} cleanLast={cleanLast} />
          ))}
        </div>
      ) : (
        <div>
          <EnvelopeBars scaling={scaling} envelope={selectedEnv} metric={metric} />
        </div>
      )}

      <DataTable scaling={scaling} metric={metric} envelopes={envelopes} selected={view === 'trend' ? null : view} />

      <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-muted">
        {t('scaling.narr.1')}
        <span className="text-pulse">{t('scaling.narr.native')}</span>
        {t('scaling.narr.2')}
        <span className="text-fg">{t('scaling.narr.mult')}</span>
        {t('scaling.narr.3')}
        <span className="text-signal">{t('scaling.narr.jvm')}</span>
        {t('scaling.narr.4')}
        <span className="text-fg">{t('scaling.narr.converge')}</span>
        {t('scaling.narr.5')}
      </p>
    </div>
  );
}
