/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'mf-text': '#eae9fc',
        'mf-bg': '#010104',
        'mf-primary': '#575ddb',
        'mf-secondary': '#5b5b6b',
        'mf-accent': '#ffffff',
        // Web-equivalent card surface: rgba(234,233,252,0.05) ≈ web's rgba(text,0.03)
        'mf-surface': 'rgba(234,233,252,0.05)',
      },
      fontFamily: {
        solway: ['Solway_400Regular'],
        'solway-medium': ['Solway_500Medium'],
        'solway-bold': ['Solway_700Bold'],
        'solway-extrabold': ['Solway_800ExtraBold'],
        'solway-light': ['Solway_300Light'],
      },
    },
  },
  plugins: [],
}
