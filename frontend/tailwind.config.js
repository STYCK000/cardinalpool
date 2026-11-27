/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-style grouped background
        paper: '#F5F5F7',
        // Neutral ramp tuned to Apple's label and separator greys.
        // Every existing slate-* class in the app picks this up automatically.
        slate: {
          50: '#FAFAFC',
          100: '#F5F5F7',
          200: '#E8E8ED',
          300: '#D2D2D7',
          400: '#A1A1A6',
          500: '#86868B',
          600: '#6E6E73',
          700: '#515154',
          800: '#333336',
          900: '#1D1D1F',
          950: '#0F0F10',
        },
        cardinal: {
          50: '#FEF3F3',
          100: '#FDE4E4',
          200: '#FBCACA',
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
        // Two soft layers, like a card resting a few points above the page
        card: '0 0 0 0.5px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03), 0 6px 20px rgba(0, 0, 0, 0.04)',
        lift: '0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.12), 0 24px 64px rgba(0, 0, 0, 0.14)',
        thumb: '0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.14), 0 3px 8px rgba(0, 0, 0, 0.06)',
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
