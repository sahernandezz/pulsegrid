import { PARADIGM_META, PACKAGING_META, STACK_META } from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';

function Pill({ active, onClick, children }) {
  return (
    <button data-active={active} onClick={onClick} className="pill">
      {children}
    </button>
  );
}

function Group({ label, values, active, fmt, onToggle }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[11px] uppercase tracking-label text-dim">{label}</span>
      {values.map((v) => (
        <Pill key={v} active={active.includes(v)} onClick={() => onToggle(v)}>
          {fmt(v)}
        </Pill>
      ))}
    </div>
  );
}

export default function Filters({ filters, setFilters, options }) {
  const { t, tMeta } = useI18n();
  const toggleArr = (key, val) =>
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });

  return (
    <div className="card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-label text-dim">{t('filters.ingest')}</span>
          <Pill active={filters.mode === 'http'} onClick={() => setFilters((f) => ({ ...f, mode: 'http' }))}>
            http
          </Pill>
          <Pill active={filters.mode === 'queue'} onClick={() => setFilters((f) => ({ ...f, mode: 'queue' }))}>
            queue
          </Pill>
        </div>
        <Group label={t('filters.stack')} values={options.stacks} active={filters.stacks}
               fmt={(s) => STACK_META[s]?.label || s} onToggle={(v) => toggleArr('stacks', v)} />
        <Group label={t('filters.paradigm')} values={options.paradigms} active={filters.paradigms}
               fmt={(p) => tMeta(PARADIGM_META[p]?.short || p)} onToggle={(v) => toggleArr('paradigms', v)} />
        <Group label={t('filters.packaging')} values={options.packagings} active={filters.packagings}
               fmt={(p) => tMeta(PACKAGING_META[p]?.label || p)} onToggle={(v) => toggleArr('packagings', v)} />
      </div>
    </div>
  );
}
