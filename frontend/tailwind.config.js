/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        toyota: {
          DEFAULT: '#eb0a1e',
          50: '#fef2f3',
          100: '#fde6e7',
          200: '#fbd0d4',
          300: '#f7a9b0',
          400: '#f27885',
          500: '#eb0a1e',
          600: '#d40a1b',
          700: '#b10917',
          800: '#920b16',
          900: '#7a0f18',
        },
        neon: {
          red: '#dc2626',
          amber: '#ffb020',
        },
        amber: {
          DEFAULT: '#ffb020',
          300: '#ffd166',
          400: '#ffb020',
          500: '#ff9500',
        },
        carbon: {
          950: '#05060b',
          900: '#0a0d18',
          850: '#0d1120',
          800: '#111728',
          700: '#1a2238',
          600: '#243150',
          500: '#33446b',
          line: '#1c2640',
        },
        frost: {
          DEFAULT: '#e6ecf7',
          400: '#8593ad',
          500: '#5d6b86',
          600: '#3f4c66',
        },
        ink: {
          DEFAULT: '#111827',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#172033',
          900: '#0f172a',
        },
        sand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'neon-red': '0 0 24px -4px rgba(255,39,64,0.55)',
        'neon-red-lg': '0 0 40px -2px rgba(255,39,64,0.7)',
        'neon-amber': '0 0 24px -4px rgba(255,176,32,0.5)',
        float: '0 20px 45px -24px rgba(15, 23, 42, 0.35)',
      },
      backgroundImage: {
        'dotgrid-dark':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(-118deg)' },
          '55%': { transform: 'rotate(46deg)' },
          '70%': { transform: 'rotate(30deg)' },
          '100%': { transform: 'rotate(38deg)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.35' },
          '96%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(255,176,32,0.6)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 0 6px rgba(255,176,32,0)' },
        },
      },
      animation: {
        sweep: 'sweep 2.2s cubic-bezier(0.22,1,0.36,1) forwards',
        flicker: 'flicker 6s infinite',
        scan: 'scan 7s linear infinite',
        ticker: 'ticker 22s linear infinite',
        'pulse-dot': 'pulseDot 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
