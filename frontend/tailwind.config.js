/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "oklch(0.18 0 0)",
        surface: "oklch(0.235 0 0)",
        "surface-elev": "oklch(0.28 0 0)",
        border: "oklch(0.32 0 0)",
        ink: "oklch(0.95 0 0)",
        muted: "oklch(0.6 0 0)",
        accent: "oklch(0.65 0.15 160)",
        "accent-short": "oklch(0.65 0.18 25)",
        danger: "oklch(0.6 0.2 25)",
        success: "oklch(0.7 0.15 150)",
        warning: "oklch(0.75 0.15 60)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
