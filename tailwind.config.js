/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Komensa "Balanced Harmony" Color Palette
        "dusty-rose": {
          50: "#fdf2f4",
          100: "#fce7ea",
          200: "#f9d0d7",
          300: "#f4aab7",
          400: "#ec7d91",
          500: "#d8a7b1", // Primary dusty rose
          600: "#c99ba4",
          700: "#b08891",
          800: "#8f6f76",
          900: "#6b5459",
          950: "#3d2f32",
        },
        "teal-custom": {
          50: "#f0f9f9",
          100: "#ccf0f0",
          200: "#9ee1e2",
          300: "#7bafb0", // Primary teal
          400: "#6d9e9f",
          500: "#5a8c8d",
          600: "#4a7374",
          700: "#3d5e5f",
          800: "#334d4e",
          900: "#2c4041",
          950: "#1a2627",
        },
        "soft-gold": {
          50: "#fefdf8",
          100: "#fdfaeb",
          200: "#fbf4d1",
          300: "#f7eaac",
          400: "#f1dc7f",
          500: "#d9c589", // Primary soft gold
          600: "#e6c869",
          700: "#d4b555",
          800: "#b8984a",
          900: "#967c3e",
          950: "#564520",
        },
        charcoal: {
          50: "#f8f9fa",
          100: "#f1f3f4",
          200: "#e9ecef",
          300: "#dee2e6",
          400: "#ced4da",
          500: "#adb5bd",
          600: "#6c757d",
          700: "#495057",
          800: "#3c4858", // Primary charcoal
          900: "#212529",
          950: "#0d1117",
        },
        "off-white": {
          50: "#ffffff",
          100: "#fefefe",
          200: "#fcfcfc",
          300: "#f9f7f4", // Primary off-white
          400: "#f5f3f0",
          500: "#f0eeeb",
          600: "#eae8e5",
          700: "#e0ddd9",
          800: "#d1cdc8",
          900: "#b8b3ad",
          950: "#8a847d",
        },
        // State colors
        success: {
          50: "#f0f9f9",
          100: "#ccf0ef",
          200: "#9ee1df",
          300: "#6db0ad", // Success color
          400: "#5a9c99",
          500: "#4a8885",
          600: "#3d6f6c",
          700: "#335a58",
          800: "#2c4847",
          900: "#263c3b",
          950: "#162423",
        },
        warning: {
          50: "#fefdf8",
          100: "#fdfaeb",
          200: "#fbf4d1",
          300: "#f7eaac",
          400: "#f1dc7f",
          500: "#e5c068", // Warning color
          600: "#d4b555",
          700: "#b8984a",
          800: "#967c3e",
          900: "#7a6533",
          950: "#453a1d",
        },
        error: {
          50: "#fdf2f4",
          100: "#fce7ea",
          200: "#f9d0d7",
          300: "#f4aab7",
          400: "#ec7d91",
          500: "#e39aa7", // Error color
          600: "#d8879a",
          700: "#c9748a",
          800: "#a8617a",
          900: "#8b5269",
          950: "#4f2d39",
        },
        // shadcn/ui compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
        "6xl": ["3.75rem", { lineHeight: "1" }],
        "7xl": ["4.5rem", { lineHeight: "1" }],
        "8xl": ["6rem", { lineHeight: "1" }],
        "9xl": ["8rem", { lineHeight: "1" }],
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        128: "32rem",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "bounce-gentle": "bounce-gentle 2s infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        typing: "typing 1.4s infinite ease-in-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        typing: {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        medium: "0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        strong: "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 2px 10px -2px rgba(0, 0, 0, 0.05)",
      },
      backdropBlur: {
        xs: "2px",
      },
      screens: {
        xs: "475px",
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    // Custom plugin for Komensa-specific utilities
    ({ addUtilities, addComponents, theme }) => {
      const newUtilities = {
        // Partner-specific utilities
        ".text-partner-a": {
          color: theme("colors.dusty-rose.500"),
        },
        ".text-partner-b": {
          color: theme("colors.teal-custom.300"),
        },
        ".text-moderator": {
          color: theme("colors.soft-gold.500"),
        },
        ".bg-partner-a": {
          backgroundColor: theme("colors.dusty-rose.500"),
        },
        ".bg-partner-b": {
          backgroundColor: theme("colors.teal-custom.300"),
        },
        ".bg-moderator": {
          backgroundColor: theme("colors.soft-gold.500"),
        },
        ".border-partner-a": {
          borderColor: theme("colors.dusty-rose.500"),
        },
        ".border-partner-b": {
          borderColor: theme("colors.teal-custom.300"),
        },
        ".border-moderator": {
          borderColor: theme("colors.soft-gold.500"),
        },
        // Gradient utilities
        ".gradient-balanced": {
          background: `linear-gradient(135deg, ${theme("colors.dusty-rose.500")}, ${theme("colors.teal-custom.300")})`,
        },
        ".gradient-partner-a": {
          background: `linear-gradient(135deg, ${theme("colors.dusty-rose.500")}, ${theme("colors.soft-gold.500")})`,
        },
        ".gradient-partner-b": {
          background: `linear-gradient(135deg, ${theme("colors.teal-custom.300")}, ${theme("colors.soft-gold.500")})`,
        },
        // Focus ring utilities
        ".focus-ring-partner-a": {
          "&:focus": {
            outline: "none",
            boxShadow: `0 0 0 2px ${theme("colors.dusty-rose.500")}`,
          },
        },
        ".focus-ring-partner-b": {
          "&:focus": {
            outline: "none",
            boxShadow: `0 0 0 2px ${theme("colors.teal-custom.300")}`,
          },
        },
        ".focus-ring-moderator": {
          "&:focus": {
            outline: "none",
            boxShadow: `0 0 0 2px ${theme("colors.soft-gold.500")}`,
          },
        },
      }

      const newComponents = {
        // Message bubble components
        ".message-bubble": {
          padding: theme("spacing.4"),
          borderRadius: theme("borderRadius.lg"),
          borderLeftWidth: "4px",
          marginBottom: theme("spacing.3"),
          animation: "fade-in 0.3s ease-out",
        },
        ".message-bubble-partner-a": {
          backgroundColor: `${theme("colors.dusty-rose.500")}15`,
          borderLeftColor: theme("colors.dusty-rose.500"),
        },
        ".message-bubble-partner-b": {
          backgroundColor: `${theme("colors.teal-custom.300")}15`,
          borderLeftColor: theme("colors.teal-custom.300"),
        },
        ".message-bubble-moderator": {
          backgroundColor: `${theme("colors.soft-gold.500")}15`,
          borderLeftColor: theme("colors.soft-gold.500"),
        },
        // Chat input components
        ".chat-input": {
          width: "100%",
          padding: theme("spacing.3"),
          border: `1px solid ${theme("colors.charcoal.800")}20`,
          borderRadius: theme("borderRadius.lg"),
          resize: "none",
          "&:focus": {
            outline: "none",
            boxShadow: `0 0 0 2px ${theme("colors.dusty-rose.500")}`,
          },
          "&:disabled": {
            backgroundColor: theme("colors.gray.100"),
            color: theme("colors.gray.400"),
          },
        },
        // Button variants
        ".btn-partner-a": {
          backgroundColor: theme("colors.dusty-rose.500"),
          color: "white",
          "&:hover": {
            backgroundColor: theme("colors.dusty-rose.600"),
          },
        },
        ".btn-partner-b": {
          backgroundColor: theme("colors.teal-custom.300"),
          color: "white",
          "&:hover": {
            backgroundColor: theme("colors.teal-custom.400"),
          },
        },
        ".btn-moderator": {
          backgroundColor: theme("colors.soft-gold.500"),
          color: "white",
          "&:hover": {
            backgroundColor: theme("colors.soft-gold.600"),
          },
        },
      }

      addUtilities(newUtilities)
      addComponents(newComponents)
    },
  ],
}
