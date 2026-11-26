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
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        primary: 'var(--primary)',
        accent: 'var(--accent)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        border: 'var(--border)',
        glow: 'var(--glow)',
      },
      fontFamily: {
        anime: ['"Orbitron"', '"Rajdhani"', '"Exo 2"', '"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px var(--primary), 0 0 24px -6px var(--primary)',
        rim: '0 0 0 1px var(--primary), 0 0 24px -6px var(--primary)',
        glass: '0 18px 42px -12px rgba(0, 0, 0, 0.72)',
      },
    },
  },
  plugins: [],
};

export default config;
