import { motion } from 'framer-motion';
import { COLUMNS, bestPerColumn, PARADIGM_META, PACKAGING_META, STACK_META } from '../lib/data.js';
import { useI18n } from '../lib/i18n.jsx';
import Badge from './Badge.jsx';

function Row({ v, best, onSelect, index, rank }) {
  const { t, tMeta, localizedNote } = useI18n();
  const supported = v.supported && v.metrics;
  const headLabel = `${tMeta(PARADIGM_META[v.paradigm]?.label || v.paradigm)} · ${tMeta(
    PACKAGING_META[v.packaging]?.label || v.packaging,
  )}`;
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.25) }}
      onClick={() => onSelect(v)}
      className={`group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-panel-2/60 ${
        supported ? '' : 'opacity-60'
      }`}
    >
      <td className="py-4 pl-4 pr-4 align-middle">
        <div className="flex items-center gap-4">
          <span
            className={`stat w-6 shrink-0 text-right text-sm font-semibold ${
              rank === 1 ? 'text-pulse' : rank ? 'text-muted' : 'text-dim'
            }`}
          >
            {rank ? String(rank).padStart(2, '0') : '—'}
          </span>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-semibold leading-tight text-fg transition-colors group-hover:text-pulse">
              {headLabel}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge>{STACK_META[v.stack]?.label || v.stack}</Badge>
              <Badge tone={PARADIGM_META[v.paradigm]?.tone}>{tMeta(PARADIGM_META[v.paradigm]?.short)}</Badge>
              <Badge tone={PACKAGING_META[v.packaging]?.tone}>{tMeta(PACKAGING_META[v.packaging]?.label)}</Badge>
            </div>
          </div>
        </div>
      </td>

      {supported ? (
        COLUMNS.map((c) => {
          const val = c.get(v);
          const isBest = best[c.key] === v.id;
          return (
            <td
              key={c.key}
              className={`stat whitespace-nowrap px-3 py-4 text-right align-middle text-[13px] ${
                isBest ? 'font-semibold text-pulse' : 'text-fg/85'
              }`}
            >
              {c.fmt(val)}
            </td>
          );
        })
      ) : (
        <td colSpan={COLUMNS.length} className="px-4 py-4 align-middle">
          <div className="flex items-center justify-end gap-3 text-right">
            <Badge tone="danger">{t('table.notSupported')}</Badge>
            <span className="max-w-md truncate text-xs text-muted" title={localizedNote(v)}>
              {localizedNote(v)}
            </span>
          </div>
        </td>
      )}
    </motion.tr>
  );
}

export default function ComparisonTable({ variants, onSelect }) {
  const { t } = useI18n();
  const best = bestPerColumn(variants);
  if (!variants.length) {
    return (
      <div className="card py-16 text-center text-sm text-muted">{t('table.noMatch')}</div>
    );
  }
  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-3 pl-4 pr-4 font-mono text-[10.5px] font-medium uppercase tracking-label text-dim">
                {t('table.variant')}
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-label text-dim">
                  {t(`col.${c.key}`)}
                  {c.unit && <span className="block text-[9px] font-normal tracking-normal text-dim/70">{c.unit}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let rank = 0;
              return variants.map((v, i) => (
                <Row key={v.id + v.ingestMode} v={v} best={best} onSelect={onSelect} index={i}
                     rank={v.supported && v.metrics ? ++rank : null} />
              ));
            })()}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-dim">
        <span className="inline-block h-2 w-2 rounded-sm bg-pulse/80" />
        {t('table.legend')}
      </p>
    </div>
  );
}
