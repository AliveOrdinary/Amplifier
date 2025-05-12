import typographyPlugin from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'custom-bg': '#f7f7f7'
      },
      fontFamily: {
        'sans': ['PP Neue Montreal', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'serif': ['Right Serif', 'Georgia', 'serif'],
        'montreal': ['PP Neue Montreal', 'sans-serif'],
        'rightserif': ['Right Serif', 'serif'],
      },
      fontWeight: {
        'book': 400,
        'regular': 500,
        'bold': 700,
      }
    },
  },
  plugins: [
    typographyPlugin,
  ],
} 