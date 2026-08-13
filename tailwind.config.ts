import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "Georgia", "serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        background: "#f5f0e8",
        foreground: "#1a1a14",
        primary: "#e05b2b",
        secondary: "#ede8df",
        muted: "#4a4a3a",
        low: "#2d6a4f",
        "low-light": "#d8f3dc",
        medium: "#e9a825",
        "medium-light": "#fef3c7",
        high: "#c1440e",
        "high-light": "#ffe4d6",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
