/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cardinal: {
          50: '#FEF2F2',
          100: '#FEE2E2',
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
    },
  },
  plugins: [],
};
