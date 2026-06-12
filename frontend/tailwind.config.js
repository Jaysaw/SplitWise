/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f2fdf5',
          100: '#e1fbe8',
          200: '#c5f7d3',
          300: '#97f0af',
          400: '#5ee183',
          500: '#34c759', // Beautiful Teal/Green
          600: '#24a544',
          700: '#1d8238',
          800: '#1c6730',
          900: '#18552a',
          950: '#0b2f15',
        },
        dark: {
          50: '#f6f6f7',
          100: '#ebeeef',
          200: '#d3dbe0',
          300: '#adbdc7',
          400: '#7e96a4',
          500: '#5f7887',
          600: '#4d616f',
          700: '#3d4d5a',
          800: '#1e293b',
          900: '#0f172a',
          950: '#030712',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
