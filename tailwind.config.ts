import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { steel: { black: "#101112", graphite: "#3E454B", orange: "#EA5B0C", mist: "#CBD0D3" } },
      boxShadow: { glow: "0 18px 50px rgba(234, 91, 12, .22)" },
    },
  },
  plugins: [],
} satisfies Config;
