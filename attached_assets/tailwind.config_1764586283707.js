/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#d97706',
          dark: '#b45309',
          light: '#fbbf24',
        },
        secondary: {
          DEFAULT: '#059669',
          dark: '#047857',
          light: '#10b981',
        },
        accent: {
          DEFAULT: '#dc2626',
          dark: '#b91c1c',
          light: '#ef4444',
        },
      },
      fontFamily: {
        chinese: ['Noto Sans TC', 'Microsoft JhengHei', 'sans-serif'],
        english: ['Rajdhani', 'Roboto', 'sans-serif'],
        number: ['Orbitron', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        jiachun: {
          "primary": "#d97706",
          "secondary": "#059669",
          "accent": "#dc2626",
          "neutral": "#374151",
          "base-100": "#1f2937",
          "base-200": "#111827",
          "base-300": "#0f172a",
          "info": "#3b82f6",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
}
