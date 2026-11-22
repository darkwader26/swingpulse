/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#1a1a1a',
        surface: '#2a2a2a',
        'surface-elev': '#333333',
        border: '#444444',
        ink: '#f2f2f2',
        muted: '#999999',
        'accent-long': '#14b8a6',
        'accent-short': '#f59e0b',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#eab308',
      },
      borderRadius: {
        radius: '6px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        body: ['13px', { lineHeight: '1.4' }],
        label: ['11px', { letterSpacing: '0.08em', fontWeight: '600' }],
        caption: ['10px', { letterSpacing: '0.08em' }],
      },
      fontWeight: {
        semibold: '600',
      },
    },
  },
  plugins: [],
}
