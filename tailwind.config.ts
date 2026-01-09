import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        movement: {
          teal: {
            50: '#E6FFF9',
            100: '#B3FFF0',
            200: '#80FFE7',
            300: '#4DFFDE',
            400: '#1AFFD5',
            500: '#00D9C0', // Primary teal
            600: '#00B3A0',
            700: '#008D80',
            800: '#006760',
            900: '#004140',
          },
          yellow: {
            50: '#FFF9E6',
            100: '#FFECB3',
            200: '#FFE080',
            300: '#FFD44D',
            400: '#FFC71A',
            500: '#FFC700', // Primary yellow
            600: '#E6B300',
            700: '#CC9F00',
            800: '#B38B00',
            900: '#997700',
          },
          dark: {
            50: '#E8EAED',
            100: '#C5C9D1',
            200: '#A2A8B5',
            300: '#7F8799',
            400: '#5C667D',
            500: '#394561',
            600: '#2D3750',
            700: '#1E2638', // Secondary dark
            800: '#141B2D',
            900: '#0A0E1A', // Primary dark
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
