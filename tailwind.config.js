/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#0f4c5c',
        gold: '#e9c46a',
        snf: '#0ea5e9',
        hospital: '#ef4444'
      }
    }
  },
  plugins: []
}
