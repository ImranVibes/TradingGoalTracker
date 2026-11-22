import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        surface: "#0f172a",
        "surface-card": "#131e36",
        "surface-border": "#1e293b",
        "brand-primary": "#38bdf8",
        "brand-accent": "#818cf8",
        profit: {
          DEFAULT: "#10b981",
          light: "#34d399",
          glow: "rgba(16, 185, 129, 0.25)",
          surface: "rgba(16, 185, 129, 0.08)",
        },
        loss: {
          DEFAULT: "#f43f5e",
          light: "#fb7185",
          glow: "rgba(244, 63, 94, 0.25)",
          surface: "rgba(244, 63, 94, 0.08)",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(56, 189, 248, 0.2)",
        "glow-profit": "0 0 25px -5px rgba(16, 185, 129, 0.25)",
        "glow-loss": "0 0 25px -5px rgba(244, 63, 94, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
