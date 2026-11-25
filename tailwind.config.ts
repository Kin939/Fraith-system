import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
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
        anime: ['"M PLUS Rounded 1c"', '"Zen Maru Gothic"', 'system-ui', 'sans-serif'],
        sans: ['"Noto Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px var(--glow), inset 0 0 12px rgba(255, 255, 255, 0.04)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.45)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
