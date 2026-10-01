import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
          950: '#082f49',
        },
        navy: {
          950: '#061332',
          900: '#0A1128',
          800: '#111D4A',
          700: '#1E2D65',
        },
        dark: {
          bg: '#090a0f',
          card: '#12141c',
          border: '#1f2333',
          hover: '#1a1d29',
          muted: '#8b949e',
        },
        status: {
          healthy: '#10b981',
          affected: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          neutral: '#6b7280',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-serif)', 'Newsreader', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
