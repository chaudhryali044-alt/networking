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
        bg: "#0C0C0A",
        "bg-card": "#141412",
        "bg-elevated": "#1A1A17",
        border: "#252520",
        "border-light": "#2E2E28",
        accent: "#B8960C",
        "accent-bright": "#D4AE1A",
        up: "#2E7D52",
        down: "#8B2635",
        text: "#E8E4DC",
        "text-muted": "#8A8679",
        "text-dim": "#4A4840",
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
