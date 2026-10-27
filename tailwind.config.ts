import type { Config } from "tailwindcss";

const color = (token: string) => `hsl(var(--${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: color("border"),
        input: color("input"),
        ring: color("focus-ring"),
        background: color("background"),
        foreground: { DEFAULT: color("foreground"), muted: color("foreground-muted") },
        surface: { DEFAULT: color("surface"), raised: color("surface-raised") },
        primary: {
          DEFAULT: color("primary"),
          foreground: color("primary-foreground"),
          hover: color("primary-hover"),
        },
        secondary: { DEFAULT: color("muted"), foreground: color("foreground") },
        destructive: { DEFAULT: color("danger"), foreground: color("danger-foreground") },
        danger: { DEFAULT: color("danger"), foreground: color("danger-foreground") },
        warning: { DEFAULT: color("warning"), foreground: color("warning-foreground") },
        muted: { DEFAULT: color("muted"), foreground: color("foreground-muted") },
        accent: { DEFAULT: color("accent"), foreground: color("accent-foreground") },
        popover: { DEFAULT: color("surface-raised"), foreground: color("foreground") },
        card: { DEFAULT: color("surface"), foreground: color("foreground") },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        panel: "0 1px 2px hsl(var(--foreground) / 0.04), 0 16px 48px hsl(var(--foreground) / 0.08)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
