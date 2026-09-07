/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Robinhood green: the brand primary, also the "up" colour.
        hood: {
          50: '#EBFCEB',
          100: '#D2F8D3',
          200: '#A7F0AA',
          300: '#71E677',
          400: '#33D93E',
          500: '#00C805',
          600: '#00A804',
          700: '#008A05',
          800: '#046B07',
          900: '#064F08',
        },
        // Robinhood Gold: the premium accent.
        gold: {
          50: '#FFF8E1',
          100: '#FFEFB8',
          200: '#FFE38A',
          300: '#FFD65C',
          400: '#F6C343',
          500: '#E9B32A',
          600: '#C9931B',
          700: '#9E7213',
        },
        // Robinhood's negative move colour.
        down: '#FF5000',
        ink: '#0B0F0C',
        mut: '#5C6660',
        line: '#E5EBE6',
        paper: '#FFFFFF',
        ground: '#F6F8F6',
        tile: '#EEF3EF',
        tape: '#0B0F0C',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-manrope)', 'var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 15, 12, 0.04), 0 10px 30px rgba(11, 15, 12, 0.06)',
        glow: '0 0 0 1px rgba(0, 200, 5, 0.18), 0 12px 40px rgba(0, 200, 5, 0.12)',
        gold: '0 0 0 1px rgba(233, 179, 42, 0.25), 0 12px 40px rgba(233, 179, 42, 0.14)',
      },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'float-slow': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        feedIn: { from: { opacity: '0', transform: 'translateY(-10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        wiggle: { '0%, 100%': { transform: 'rotate(-9deg)' }, '50%': { transform: 'rotate(9deg)' } },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(24px, -18px) scale(1.12)' },
          '66%': { transform: 'translate(-18px, 16px) scale(0.92)' },
        },
        pop: { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        orbit: { from: { transform: 'rotate(0deg) translateX(var(--r)) rotate(0deg)' }, to: { transform: 'rotate(360deg) translateX(var(--r)) rotate(-360deg)' } },
        tick: { '0%': { backgroundColor: 'rgba(0,200,5,0.35)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        feedin: 'feedIn 0.4s ease-out',
        wiggle: 'wiggle 0.5s ease-in-out',
        blob: 'blob 14s ease-in-out infinite',
        pop: 'pop 0.4s ease-out',
        orbit: 'orbit 22s linear infinite',
        tick: 'tick 1.2s ease-out',
      },
    },
  },
  plugins: [],
}
