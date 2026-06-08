import { useI18n } from '../lib/i18n.jsx';

// Banner shown when the consolidated file is sample/illustrative data.
export default function SampleBanner() {
  const { t } = useI18n();
  return (
    <div className="border-b border-warn/25 bg-warn/[0.07]">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
        <p className="text-[13px] text-warn">
          <span className="font-medium">{t('sample.title')}</span>
          <span className="text-warn/80">{t('sample.body1')}</span>
          <span className="font-mono text-[12px] text-fg">runner/run_benchmarks.py</span>
          <span className="text-warn/80">{t('sample.body2')}</span>
        </p>
      </div>
    </div>
  );
}
