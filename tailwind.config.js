/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Shared app palette, aligned with the bento homepage: navy surfaces,
        // pink primary actions, teal accents, gold highlights.
        brodin: {
          bg: '#004b84',
          panel: '#003a68',
          field: '#00243f',
          primary: '#f9749f',
          primaryDark: '#e0537f',
          accent: '#03d1b9',
          gold: '#facc15',
        },
        bento: {
          navy: '#004b84',
          teal: '#03d1b9',
          pink: '#f9749f',
          pinkLight: '#ffa5c6',
          blue: '#79c9fa',
          text: '#df608f',
          cream: '#feefc8',
          pin: '#ed6c72',
        },
        // Homepage palette, sampled directly from the Canva mockup
        // (Design Docs/Home Page). Cards alternate cyan/pink.
        home: {
          cyan: '#9bf6ff',
          pink: '#e86eca',
          featured: '#f6d7e9',
          play: '#38b6ff',
          star: '#ffd700',
          ink: '#0d0d0d',
        },
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}
