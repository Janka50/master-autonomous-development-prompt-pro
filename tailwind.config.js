/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: {
          950: '#060d1f',
          900: '#0b1633',
          850: '#101f46',
          800: '#172a5c',
          700: '#233d7d',
        },
        gold: {
          50: '#fefdf8',
          100: '#fdf9ee',
          200: '#faf0d4',
          300: '#f5dfab',
          400: '#eec475',
          500: '#e5a842',
          600: '#c88629',
          700: '#a36420',
        },
        terracotta: {
          500: '#ea580c',
          600: '#c2410c',
        },
        savanna: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Outfit', 'Cabinet Grotesk', 'sans-serif'],
      },
      backgroundImage: {
        'pattern-kente': "radial-gradient(circle at 20% 20%, rgba(229, 168, 66, 0.05) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(35, 61, 125, 0.1) 0%, transparent 40%)",
      }
    },
  },
  plugins: [],
}