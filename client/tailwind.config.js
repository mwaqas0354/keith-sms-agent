/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        luxury: {
          50: '#FBF9F6',
          100: '#F7F3ED',
          150: '#F0EBE3',
          200: '#E5DDD2',
          300: '#D5C9B8',
          400: '#9C9185',
          500: '#6B6560',
          600: '#4A4541',
          700: '#352F2B',
          800: '#1F1B18',
          900: '#141210',
        },
        navy: {
          50: '#F0F4F8',
          100: '#D9E4EF',
          700: '#1E3A5F',
          800: '#152A45',
          900: '#0F1F33',
        },
        gold: {
          50: '#FBF6EE',
          100: '#F5EBD9',
          200: '#E8D5B0',
          400: '#C9A962',
          500: '#B8956A',
          600: '#9A7B4F',
        },
        brand: {
          50: '#F0F4F8',
          100: '#D9E4EF',
          200: '#B3C9DF',
          300: '#8DAECF',
          400: '#5C85A8',
          500: '#3D6A8F',
          600: '#2A5575',
          700: '#1E3A5F',
          800: '#152A45',
          900: '#0F1F33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        luxury: '0 4px 24px -4px rgba(20, 18, 16, 0.08), 0 2px 8px -2px rgba(20, 18, 16, 0.04)',
        'luxury-lg': '0 12px 40px -8px rgba(20, 18, 16, 0.12), 0 4px 16px -4px rgba(20, 18, 16, 0.06)',
        gold: '0 4px 20px -4px rgba(184, 149, 106, 0.35)',
      },
      backgroundImage: {
        'luxury-page': 'linear-gradient(135deg, #FBF9F6 0%, #F7F3ED 40%, #FBF6EE 100%)',
        'luxury-sidebar': 'linear-gradient(180deg, #FFFFFF 0%, #F7F3ED 100%)',
        'gold-shine': 'linear-gradient(135deg, #C9A962 0%, #B8956A 50%, #9A7B4F 100%)',
        'navy-shine': 'linear-gradient(135deg, #1E3A5F 0%, #152A45 100%)',
      },
    },
  },
  plugins: [],
};
