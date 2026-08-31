import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // Tailwind only emits utilities it can read as literals in a scanned file.
    // The test-mode banner and the hero offsets it pairs with are declared here,
    // so this file has to be scanned like a component — otherwise the classes
    // reach the markup with no CSS behind them and the layout silently breaks.
    // Named explicitly rather than globbing ./data: the rest of that directory
    // is prose content with no presentation classes to extract.
    "./data/site-mode.ts",
  ],
  theme: {
    extend: {
      colors: { steel: { black: "#101112", graphite: "#3E454B", orange: "#EA5B0C", "orange-deep": "#C64D09", "orange-deeper": "#A83F07", mist: "#CBD0D3" } },
      boxShadow: { glow: "0 18px 50px rgba(234, 91, 12, .22)" },
    },
  },
  plugins: [],
} satisfies Config;
