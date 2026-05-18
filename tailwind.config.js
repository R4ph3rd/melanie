/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design system surface layers
        bg:       '#080808',
        surface:  '#111111',
        surface2: '#1a1a1a',
        surface3: '#222222',
        surface4: '#2a2a2a',
        'border-bright': '#444444',

        // Text hierarchy
        'text-primary':   '#f0f0f0',
        'text-secondary': '#a0a0a0',
        'text-muted':     '#606060',
        'text-disabled':  '#404040',

        // Accent : primary (purple)
        accent:         '#7c3aed',
        'accent-hover': '#6d28d9',
        'accent-dim':   '#3b1f6e',

        // Node type colours
        'node-sketch':   '#1a1f2e',
        'node-operator': '#1c1428',
        'node-merge':    '#0f1d2e',
        'node-diff':     '#0f1f18',
        'node-extract':  '#1f1a0e',

        // Operation type accent colours
        'op-modify':    '#7c3aed',
        'op-duplicate': '#374151',
        'op-merge':     '#1d4ed8',
        'op-diff':      '#047857',
        'op-extract':   '#b45309',

        // Status
        success: '#10b981',
        warning: '#f59e0b',
        error:   '#ef4444',
        info:    '#3b82f6',

        // shadcn/ui design tokens
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs:    ['11px', '16px'],
        sm:    ['12px', '18px'],
        base:  ['13px', '20px'],
        md:    ['14px', '20px'],
        lg:    ['16px', '24px'],
      },
      borderRadius: {
        sm:      'calc(var(--radius) - 4px)',
        DEFAULT: '6px',
        md:      'calc(var(--radius) - 2px)',
        lg:      'var(--radius)',
        xl:      '16px',
      },
      boxShadow: {
        'node':    '0 4px 24px rgba(0,0,0,0.6)',
        'node-active': '0 0 0 2px #7c3aed, 0 4px 24px rgba(0,0,0,0.6)',
        'panel':   '4px 0 24px rgba(0,0,0,0.5)',
        'popup':   '0 8px 32px rgba(0,0,0,0.7)',
        'glow':    '0 0 12px rgba(124,58,237,0.4)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-glow': 'pulse 2s ease-in-out infinite',
        'slide-in':  'slideIn 0.2s ease-out',
        'fade-in':   'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
