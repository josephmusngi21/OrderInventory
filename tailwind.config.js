/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        canvas: "#f5f7f2",
        accent: "#047857",
      },
    },
  },
  plugins: [],
};
