/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled from the Flip 7 box art: deco teal, cream card stock,
        // tomato red banner, marquee yellow, deep navy ink.
        teal: {
          50: '#E6F7F5',
          100: '#C2ECE8',
          300: '#5FCFC6',
          400: '#2FBDB2',
          500: '#17A79D',
          600: '#0F8A83',
          700: '#0B6C68',
          800: '#084F4D',
          900: '#063A39',
        },
        cream: {
          DEFAULT: '#F7F1E1',
          dark: '#EADFC4',
        },
        tomato: {
          DEFAULT: '#E2452C',
          dark: '#B8331E',
          light: '#F26A50',
        },
        marquee: {
          DEFAULT: '#F9BE3B',
          dark: '#D99A18',
        },
        ink: {
          DEFAULT: '#0D2B3A',
          soft: '#31505F',
        },
        frost: '#5AB4E8',
        grape: '#7C5CC4',
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Arial Black"', 'Impact', 'sans-serif'],
        body: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 0 0 rgba(13,43,58,0.25), 0 10px 24px -8px rgba(0,0,0,0.4)',
        'card-sm': '0 3px 0 0 rgba(13,43,58,0.25), 0 6px 14px -6px rgba(0,0,0,0.35)',
        press: '0 4px 0 0 rgba(13,43,58,0.45)',
        glow: '0 0 0 3px rgba(249,190,59,0.55), 0 0 28px -4px rgba(249,190,59,0.8)',
      },
      keyframes: {
        'flip-in': {
          '0%': { transform: 'rotateY(90deg) scale(0.8)', opacity: '0' },
          '60%': { transform: 'rotateY(-10deg) scale(1.06)', opacity: '1' },
          '100%': { transform: 'rotateY(0deg) scale(1)', opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px) rotate(-2deg)' },
          '40%': { transform: 'translateX(8px) rotate(2deg)' },
          '60%': { transform: 'translateX(-5px) rotate(-1deg)' },
          '80%': { transform: 'translateX(5px) rotate(1deg)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(249,190,59,0.7)' },
          '70%': { boxShadow: '0 0 0 14px rgba(249,190,59,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(249,190,59,0)' },
        },
        drift: {
          '0%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(4deg)' },
          '100%': { transform: 'translateY(0) rotate(0deg)' },
        },
        'rise-fade': {
          '0%': { transform: 'translateY(16px) scale(0.9)', opacity: '0' },
          '15%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '80%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-20px) scale(0.95)', opacity: '0' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        'flip-in': 'flip-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-in': 'pop-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shake: 'shake 480ms ease-in-out both',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        drift: 'drift 7s ease-in-out infinite',
        'rise-fade': 'rise-fade 2.6s ease-out both',
        confetti: 'confetti 2.8s linear forwards',
      },
    },
  },
  plugins: [],
};
