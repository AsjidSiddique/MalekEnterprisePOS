import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: token("ink-950"), 900: token("ink-900"), 800: token("ink-800"), 700: token("ink-700"), 600: token("ink-600"),
          500: token("ink-500"), 400: token("ink-400"), 300: token("ink-300"), 200: token("ink-200"), 100: token("ink-100"),
        },
        accent: { DEFAULT: token("accent"), strong: token("accent-strong"), ink: token("accent-ink") },
        paper: token("paper"),
        surface: token("surface"),
        line: token("line"),
        muted: token("muted"),
        ok: token("ok"),
        live: token("live"),
        warn: token("warn"),
        bad: token("bad"),
        signal: token("signal"),
        info: token("info"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        receipt: ["var(--font-receipt)", "ui-monospace", "monospace"],
      },
      borderRadius: { field: "8px", panel: "14px", xl2: "22px", xl3: "30px" },
      boxShadow: {
        card: "0 1px 0 rgb(12 26 61 / 0.04), 0 10px 28px -16px rgb(12 26 61 / 0.20)",
        lift: "0 1px 0 rgb(12 26 61 / 0.04), 0 22px 44px -20px rgb(12 26 61 / 0.32)",
        pop: "0 28px 70px -24px rgb(7 14 36 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.06)",
        glow: "0 0 0 1px rgb(255 199 44 / 0.55), 0 14px 44px -10px rgb(255 199 44 / 0.5)",
        btn: "inset 0 1px 0 rgb(255 255 255 / 0.35), 0 1px 2px rgb(12 26 61 / 0.25), 0 8px 18px -8px rgb(214 149 0 / 0.65)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        ring: { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.7)", opacity: "0" } },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        rise: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        ring: "ring 2s ease-out infinite",
        blink: "blink 1.1s steps(1) infinite",
        rise: "rise 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
