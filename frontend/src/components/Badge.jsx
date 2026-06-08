// Compact labelled chip — subtle tinted border per semantic tone.
const TONE = {
  pulse: 'text-pulse border-pulse/30 bg-pulse/10',
  signal: 'text-signal border-signal/30 bg-signal/10',
  warn: 'text-warn border-warn/30 bg-warn/10',
  danger: 'text-danger border-danger/30 bg-danger/10',
  good: 'text-good border-good/30 bg-good/10',
  muted: 'text-muted border-line bg-panel-2',
};

export default function Badge({ tone = 'muted', children }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-medium leading-none ${
        TONE[tone] || TONE.muted
      }`}
    >
      {children}
    </span>
  );
}
