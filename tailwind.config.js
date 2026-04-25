/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'cyber-green': '#00FFA3',
        'cyber-dark': '#1A1A1A',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Inter', 'monospace'],
      },
    },
  },
  plugins: [],
}
