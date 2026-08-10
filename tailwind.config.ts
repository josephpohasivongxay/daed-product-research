import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#dbe6fe',
          200: '#bccffe',
          300: '#8babfc',
          400: '#5b82f8',
          500: '#3660f2',
          600: '#2141e6',
          700: '#1c33c9',
          800: '#1c2ea3',
          900: '#1c2c80',
        },
      },
    },
  },
  plugins: [],
};

export default config;
