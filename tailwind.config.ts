import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: {
      none: '0px',
      sm: '0px',
      DEFAULT: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '9999px',
    },
    extend: {
      colors: {
        deep: 'var(--bg-deep)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--surface-raised)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        text: 'var(--text)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        border: 'var(--border)',
        glow: 'var(--glow)',
        positive: '#4cc38a',
        negative: '#e5484d',
        warning: '#e5a93b',
      },
      fontFamily: {
        anime: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px color-mix(in srgb, var(--primary) 55%, transparent)',
        rim: '0 0 0 1px color-mix(in srgb, var(--primary) 55%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        glass: '0 12px 32px rgba(0, 0, 0, 0.45)',
      },
      transitionTimingFunction: {
        unslop: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
