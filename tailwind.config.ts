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
          "yellow-dark": "#E5C400",
          dark: "#050508",
        },
        glass: {
          bg: "rgba(255, 255, 255, 0.03)",
          border: "rgba(255, 255, 255, 0.08)",
          highlight: "rgba(255, 255, 255, 0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        glass: "20px",
      },
      animation: {
        "border-glow": "border-glow 2s ease-in-out infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "border-glow": {
          "0%, 100%": {
            borderColor: "rgba(255, 218, 0, 0.3)",
            boxShadow: "0 0 10px rgba(255, 218, 0, 0.1)",
          },
          "50%": {
            borderColor: "rgba(255, 218, 0, 0.5)",
            boxShadow: "0 0 20px rgba(255, 218, 0, 0.2)",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
