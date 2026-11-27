/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Everything below reads CSS variables (see index.css), so light and
        // dark mode swap values without touching a single component class.
        paper: v('paper'),
        surface: v('surface'),
        thumb: v('thumb'),
        accent: v('accent'),
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, v(`slate-${n}`)])
        ),
        cardinal: {
          50: v('cardinal-50'),
          100: v('cardinal-100'),
          200: v('cardinal-200'),
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
          800: '#7F1D1D',
          900: '#5C1111',
        },
        gold: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        // Soft status tints and their readable text shades
        amber: { 50: v('amber-50'), 200: v('amber-200'), 700: v('amber-700'), 800: v('amber-800'), 900: v('amber-900') },
        rose: { 50: v('rose-50'), 200: v('rose-200'), 700: v('rose-700'), 800: v('rose-800') },
        emerald: {
          50: v('emerald-50'),
          100: v('emerald-100'),
          200: v('emerald-200'),
          700: v('emerald-700'),
          800: v('emerald-800'),
          900: v('emerald-900'),
        },
        red: { 50: v('red-50'), 200: v('red-200'), 600: v('red-600'), 700: v('red-700') },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '28px',
      },
      boxShadow: {
        // Defined per theme in index.css
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        thumb: 'var(--shadow-thumb)',
      },
      // The iOS sheet curve. Quick start, long gentle settle.
      // Setting it as the default means every `transition` in the app uses it.
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.32, 0.72, 0, 1)',
        apple: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        DEFAULT: '220ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 380ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'overlay-in': 'overlay-in 260ms ease-out both',
        'sheet-in': 'sheet-in 460ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'toast-in': 'toast-in 420ms cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
  plugins: [],
};
