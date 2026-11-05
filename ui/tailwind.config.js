/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        outfit: ['Outfit', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        cormorant: ['Cormorant Garamond', 'Georgia', 'serif'],
        instrument: ['Instrument Serif', 'Fraunces', 'Georgia', 'serif'],
        fraunces: ['Fraunces', 'Georgia', 'serif'],
        grotesk: ['Space Grotesk', 'Outfit', 'system-ui', 'sans-serif'],
        jost: ['Jost', 'Outfit', 'system-ui', 'sans-serif'],
        figtree: ['Figtree', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
        18: '4.5rem',
        88: '22rem',
        112: '28rem',
        128: '32rem',
      },
      colors: {
        border: 'hsl(var(--border))',
        separator: 'hsl(var(--separator))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          strong: 'hsl(var(--primary-strong))',
        },
        'brand-ink': 'hsl(var(--brand-ink))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
          muted: 'hsl(var(--sidebar-muted))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
        'collapsible-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapsible-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-in-from-top': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-from-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        // Stage deck push. Pure translation, no cross-fade: the arriving stage is
        // opaque and slides over the one it replaces, the way a native
        // navigation push does. Fading both layers instead reads as a dissolve
        // and lets text ghost through. Percentages keep the travel proportional
        // to the rail width rather than a fixed nudge, and exits match entrances
        // exactly so the pair moves as one strip.
        'stage-in-forward': {
          from: { transform: 'translate3d(38%, 0, 0)' },
          to: { transform: 'translate3d(0, 0, 0)' },
        },
        'stage-in-back': {
          from: { transform: 'translate3d(-38%, 0, 0)' },
          to: { transform: 'translate3d(0, 0, 0)' },
        },
        'stage-out-forward': {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-38%, 0, 0)' },
        },
        'stage-out-back': {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(38%, 0, 0)' },
        },
        'stage-label-in-forward': {
          from: { opacity: '0', transform: 'translate3d(12px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'stage-label-in-back': {
          from: { opacity: '0', transform: 'translate3d(-12px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'slide-in-from-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-5%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'turtle-blink': {
          '0%, 92%, 100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.1)' },
        },
        'think-dot': {
          '0%, 100%': { opacity: '0.35', transform: 'translateY(0)' },
          '50%': { opacity: '1', transform: 'translateY(-3px)' },
        },
        // Light passing down the AI review list while checks run. Travel is a
        // multiple of the band's own height, so it clears a list of any length.
        'ai-scan': {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '12%, 82%': { opacity: '1' },
          '100%': { transform: 'translateY(460%)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
        'collapsible-up': 'collapsible-up 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out',
        'fade-up': 'fade-up 0.3s ease-out',
        'fade-down': 'fade-down 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s ease-out',
        'slide-in-from-left': 'slide-in-from-left 0.3s ease-out',
        // Both directions share one timing so the deck reads as a single strip.
        // The curve starts immediately (no lazy ease-in) but keeps visible travel
        // past 200ms — a sharper expo-out is ~90% done by 100ms, which is what
        // made the old transition read as a fade with a nudge rather than a slide.
        // `STAGE_TRANSITION_MS` in WorkflowStageSlide.tsx must match it.
        'stage-in-forward': 'stage-in-forward 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'stage-in-back': 'stage-in-back 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'stage-out-forward': 'stage-out-forward 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'stage-out-back': 'stage-out-back 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'stage-label-in-forward':
          'stage-label-in-forward 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'stage-label-in-back': 'stage-label-in-back 0.28s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'scale-out': 'scale-out 0.2s ease-out',
        shimmer: 'shimmer 2s linear infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite',
        float: 'float 3s ease-in-out infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'turtle-blink': 'turtle-blink 5s ease-in-out infinite',
        'think-dot': 'think-dot 1.2s ease-in-out infinite',
        'ai-scan': 'ai-scan 2.6s cubic-bezier(0.37, 0, 0.63, 1) infinite',
      },
      boxShadow: {
        'soft-xs': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft-sm': '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 2px 4px 0 rgb(0 0 0 / 0.03)',
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 2px 4px 0 rgb(0 0 0 / 0.03), 0 4px 8px 0 rgb(0 0 0 / 0.03)',
        'soft-md':
          '0 2px 4px 0 rgb(0 0 0 / 0.04), 0 4px 8px 0 rgb(0 0 0 / 0.04), 0 8px 16px 0 rgb(0 0 0 / 0.04)',
        'soft-lg':
          '0 4px 6px 0 rgb(0 0 0 / 0.05), 0 10px 20px 0 rgb(0 0 0 / 0.05), 0 20px 40px 0 rgb(0 0 0 / 0.05)',
        'soft-xl': '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 20px 50px -10px rgb(0 0 0 / 0.1)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 4px 6px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 10px 15px -3px rgb(0 0 0 / 0.07)',
        elevated: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 20px 50px -10px rgb(0 0 0 / 0.1)',
        'elevated-lg': 'var(--shadow-elevated-lg)',
        glow: '0 0 15px -3px hsl(var(--primary) / 0.3)',
        'glow-md': '0 0 25px -5px hsl(var(--primary) / 0.4)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        medium: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
        hard: '0 10px 40px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
      },
      transitionDuration: {
        250: '250ms',
        350: '350ms',
        400: '400ms',
      },
      transitionTimingFunction: {
        'ease-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary':
          'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
        'gradient-card':
          'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted) / 0.3) 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')],
};
