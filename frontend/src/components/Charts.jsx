import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../lib/i18n.jsx';

const PULSE = '#2dd4bf'; // native
const SIGNAL = '#7c9bf5'; // jvm
const GRID = '#1b212b';
const AXIS = '#7d8794';
const SERIES = ['#2dd4bf', '#7c9bf5', '#f0b35b', '#f0746a'];

const mono = '"IBM Plex Mono", monospace';
const tickStyle = { fill: AXIS, fontSize: 11, fontFamily: mono };
const tooltipStyle = {
  background: '#0f131a',
  border: '1px solid #212833',
  borderRadius: 8,
  boxShadow: '0 18px 48px -16px rgba(0,0,0,0.8)',
  fontFamily: mono,
  fontSize: 12,
  color: '#e6e9ef',
};
const cursorFill = { fill: 'rgba(45,212,191,0.07)' };

function short(id) {
  return id
    .replace('spring-', 's-').replace('quarkus-', 'q-')
    .replace('virtual-threads', 'vt').replace('webflux', 'wf')
    .replace('reactive', 'rx').replace('imperative', 'imp')
    .replace('-native', '-nat');
}

function Card({ title, subtitle, children }) {
  return (
    <div className="card min-w-0 overflow-hidden p-5">
      <div className="mb-4">
        <h3 className="font-display text-[15px] font-semibold text-fg">{title}</h3>
        {subtitle && <p className="mt-0.5 font-mono text-[11px] text-dim">{subtitle}</p>}
      </div>
      <div className="h-60 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SingleBar({ variants, get, log = false, ...rest }) {
  // `rest` carries the width/height ResponsiveContainer injects into its direct
  // child — forward them to BarChart, otherwise it renders at 0×0 (empty).
  const data = variants.map((v) => ({ name: short(v.id), value: get(v), native: v.packaging === 'native' }));
  return (
    <BarChart {...rest} data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="name" tick={tickStyle} angle={-30} textAnchor="end" height={64} interval={0} stroke={GRID} tickLine={false} />
      <YAxis tick={tickStyle} stroke={GRID} tickLine={false} scale={log ? 'log' : 'auto'} domain={log ? [1, 'auto'] : [0, 'auto']} allowDataOverflow={log} width={52} />
      <Tooltip contentStyle={tooltipStyle} cursor={cursorFill} />
      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.native ? PULSE : SIGNAL} />
        ))}
      </Bar>
    </BarChart>
  );
}

export default function Charts({ variants }) {
  const { t } = useI18n();
  if (!variants.length) return null;
  const latency = variants.map((v) => ({
    name: short(v.id),
    p50: v.metrics?.latencyMs?.p50,
    p95: v.metrics?.latencyMs?.p95,
    p99: v.metrics?.latencyMs?.p99,
    'p99.9': v.metrics?.latencyMs?.p999,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('charts.throughput.title')} subtitle={t('charts.throughput.sub')}>
        <SingleBar variants={variants} get={(v) => v.metrics?.throughputRps?.median} />
      </Card>

      <Card title={t('charts.coldStart.title')} subtitle={t('charts.coldStart.sub')}>
        <SingleBar variants={variants} get={(v) => v.metrics?.startupMs?.median} log />
      </Card>

      <Card title={t('charts.idleRss.title')} subtitle={t('charts.idleRss.sub')}>
        <SingleBar variants={variants} get={(v) => v.metrics?.idleRssMb?.median} />
      </Card>

      <Card title={t('charts.latency.title')} subtitle={t('charts.latency.sub')}>
        <BarChart data={latency} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={tickStyle} angle={-30} textAnchor="end" height={64} interval={0} stroke={GRID} tickLine={false} />
          <YAxis tick={tickStyle} stroke={GRID} tickLine={false} width={52} />
          <Tooltip contentStyle={tooltipStyle} cursor={cursorFill} />
          <Legend wrapperStyle={{ fontFamily: mono, fontSize: 11, color: AXIS }} />
          {['p50', 'p95', 'p99', 'p99.9'].map((k, i) => (
            <Bar key={k} dataKey={k} fill={SERIES[i]} radius={[3, 3, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </Card>
    </div>
  );
}
