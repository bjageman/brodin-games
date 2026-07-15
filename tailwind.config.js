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
        // Fake It's gallery look: a high-contrast serif for headings, a marker
        // script for the names painted on the lobby easels.
        serifDisplay: ['"Playfair Display"', 'Georgia', 'serif'],
        script: ['Caveat', 'cursive'],
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
        // Fake It palette, sampled from the Canva mockups
        // (Design Docs/Fake It To Make It). The mockups export with no page
        // background, so `dark`/`light` below are ours: the play screens
        // (prompt / drawing / round totals) use light type and need `dark`,
        // while the lobby / vote / final screens use brown type on `light`.
        // Bomb Disarm palette, sampled from the Canva mockup
        // (Design Docs/Bomb Defuse/Cards Landscape.png).
        bomb: {
          bg: '#262f71',
          board: '#2d3782',
          card: '#665adb',
          cardEdge: '#4b3fc0',
          face: '#9a95dd',
          bolt: '#fcec79',
          boltEdge: '#e0952c',
          wire: '#1d97ad',
          ink: '#1a1f4d',
          rebel: '#f9749f',
        },
        fakeit: {
          dark: '#17100d',
          light: '#ffffff',
          bar: '#573b2f',   // dark brown top bar on the play screens
          panel: '#d6b4a0',  // tan prompt / payout panel
          button: '#c18d5c', // vote + primary buttons
          ink: '#ae7d5c',    // brown headings
          money: '#0c1a3b',  // navy currency figures
          easel: '#f6a554',  // easel wood
          easelDark: '#bf7337',
        },
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        // Fake It role reveal: the two halves draw back like stage curtains,
        // holding closed for a beat before they part.
        curtainLeft: {
          '0%, 18%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        curtainRight: {
          '0%, 18%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        verdictIn: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
        curtainLeft: 'curtainLeft 1.6s cubic-bezier(0.7, 0, 0.3, 1) forwards',
        curtainRight: 'curtainRight 1.6s cubic-bezier(0.7, 0, 0.3, 1) forwards',
        verdictIn: 'verdictIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
