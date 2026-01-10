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
          yellow: "#FFDA00",
          "yellow-light": "#FFF4B3",
          dark: "#050508",
        },
        glass: {
          bg: "rgba(255, 255, 255, 0.03)",
          border: "rgba(255, 255, 255, 0.08)",
          highlight: "rgba(255, 255, 255, 0.12)",
        },
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};
export default config;
