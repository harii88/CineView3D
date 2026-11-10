import path from 'node:path';
import type { Config } from 'tailwindcss';

export default {
  // Absolute, forward-slash glob so the config works whatever the working directory is.
  content: [path.join(__dirname, 'src').split(path.sep).join('/') + '/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07060a', 900: '#0d0b12', 850: '#121019', 800: '#17141f', 700: '#221e2c', 600: '#2f2a3b' },
        gold: { 300: '#f5d28a', 400: '#efbf5a', 500: '#e0a83a' },
        velvet: { 500: '#b3243b', 600: '#8f1b2f' },
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
      boxShadow: { glass: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' },
    },
  },
  plugins: [],
} satisfies Config;
