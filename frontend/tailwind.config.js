/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F7F4",
        ink: "#2A2A2A",
        indigo: "#2F3A56",
      },
      fontFamily: {
        sans: ["Noto Sans JP", "system-ui", "sans-serif"],
        serif: ["Noto Serif JP", "Georgia", "serif"],
      },
      transitionDuration: {
        fade: "500ms",
      },
    },
  },
  plugins: [],
};
