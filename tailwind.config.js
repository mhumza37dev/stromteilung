/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand greens — primary interactive color across the marketplace
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          400: '#22c55e',
          600: '#16a34a',
          700: '#15803d', // primary
          800: '#166534',
          900: '#14532d',
        },
        // Surface tones used for page backgrounds and subtle fills
        surface: {
          DEFAULT: '#f8faf7',
          card:    '#ffffff',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card:    '0 8px 40px rgba(0,0,0,0.07)',
        popover: '0 8px 28px rgba(0,0,0,0.12)',
      },
      keyframes: {
        spin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        spin: 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
};
