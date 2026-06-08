import { LANGS, useI18n } from '../lib/i18n.jsx';

// Compact EN/ES segmented control. Defaults follow the device language; a manual
// pick is remembered (see i18n.jsx). Matches the top-bar tag/pill aesthetic.
export default function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('nav.langLabel')}
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-panel p-0.5"
    >
      {LANGS.map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-label transition-colors ${
              active ? 'bg-pulse/15 text-pulse' : 'text-dim hover:text-fg'
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
