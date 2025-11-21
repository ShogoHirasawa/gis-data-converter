/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          base: '#7FAD6F',
          lighter: '#A3C595',
          darker: '#6B9A5B',
        },
        text: {
          primary: '#2A3A28',
          secondary: '#5A6A58',
          tertiary: '#8A9A88',
          quaternary: '#B5C4B3',
        },
        success: {
          default: '#C8E4C1',
          light: '#E5F4E3',
        },
        error: {
          default: '#E5B8B0',
          light: '#F5DDD9',
        },
        warning: {
          default: '#F4D9B8',
          light: '#FBF0D9',
        },
        function: {
          default: '#6B8DB5',
          light: '#D1E3F2',
        },
        accent: {
          amber: '#D9B88F',
          teal: '#8BAAA5',
          taupe: '#B8A99A',
        },
      },
      borderRadius: {
        'small': '16px',
        'medium': '24px',
        'large': '32px',
      },
      boxShadow: {
        'gentle': '0 2px 12px rgba(127, 173, 111, 0.08)',
        'moderate': '0 4px 16px rgba(127, 173, 111, 0.12)',
        'prominent': '0 6px 24px rgba(127, 173, 111, 0.16)',
      },
    },
  },
  plugins: [],
}

