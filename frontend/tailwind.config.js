/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // --- neutral surfaces (cool slate, enterprise dark) ---------------
        ink: '#0a0c10', // app canvas
        panel: '#0f131a', // card / panel surface
        'panel-2': '#151a22', // raised / hover surface
        line: '#212833', // hairline border
        'line-strong': '#2c3340', // hover / emphasis border
        // --- text -----------------------------------------------------------
        fg: '#e6e9ef', // primary text  (~13:1 on ink)
        muted: '#9aa4b4', // secondary text (~7:1 on ink)
        dim: '#6a7488', // tertiary / captions (~4.6:1 on ink)
        // --- accent + data --------------------------------------------------
        pulse: '#2dd4bf', // primary · brand · native series · "best"
        'pulse-ink': '#06231f', // text on a solid pulse fill
        signal: '#7c9bf5', // secondary · JVM series
        violet: '#a78bfa', // extra categorical
        warn: '#f0b35b',
        danger: '#f0746a',
        good: '#4cc08d',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: { label: '0.08em', wide: '0.14em' },
      borderRadius: { card: '0.625rem' }, // 10px
      boxShadow: {
        // subtle elevation tuned for dark surfaces (no glow)
        card: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.012)',
        pop: '0 18px 48px -16px rgba(0,0,0,0.8)',
        focus: '0 0 0 3px rgba(45,212,191,0.30)',
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
