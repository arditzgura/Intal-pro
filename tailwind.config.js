/** @type {import('tailwindcss').Config} */
export default {
  content: [
    'index.html',
    '*.tsx',
    'components/**/*.tsx',
    'utils/**/*.ts',
  ],
  theme: {
    extend: {
      // Forco font-weight minimal 700 për të gjitha madhësitë
      fontWeight: {
        thin:       '600',
        extralight: '600',
        light:      '600',
        normal:     '700',
        medium:     '700',
        semibold:   '800',
        bold:       '800',
        extrabold:  '900',
        black:      '900',
      },
      colors: {
        // Slate: ngjyrat e lehta bëhen shumë më të errëta
        slate: {
          50:  '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#64748b', // ishte #cbd5e1 — shumë e lehtë
          400: '#334155', // ishte #94a3b8 — gri i lehtë → i errët
          500: '#1e293b', // ishte #64748b → shumë i errët
          600: '#0f172a', // ishte #475569 → pothuajse i zi
          700: '#0f172a',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // Gray: njësoj
        gray: {
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#6b7280', // ishte #d1d5db
          400: '#374151', // ishte #9ca3af → i errët
          500: '#1f2937', // ishte #6b7280 → shumë i errët
          600: '#111827',
          700: '#111827',
          800: '#1f2937',
          900: '#111827',
        },
        // Green: ngjyrat e lehta → jeshile e fortë
        green: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#16a34a', // ishte #86efac — i lehtë → i fortë
          400: '#16a34a', // ishte #4ade80
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
        },
        // Emerald: jeshile tjetër
        emerald: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#059669',
          400: '#059669',
          500: '#059669',
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
        },
        // Red: ngjyrat e lehta → e kuqe e fortë
        red: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#dc2626', // ishte #fca5a5 — i lehtë → i fortë
          400: '#dc2626', // ishte #f87171
          500: '#dc2626',
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
        // Rose: ngjyrë e kuqe-rozë
        rose: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#e11d48',
          400: '#e11d48',
          500: '#e11d48',
          600: '#be123c',
          700: '#9f1239',
          800: '#881337',
          900: '#4c0519',
        },
        // Amber/Orange: ngjyrat e dobta → të forta
        amber: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#d97706',
          400: '#d97706',
          500: '#d97706',
          600: '#b45309',
          700: '#92400e',
          800: '#78350f',
          900: '#451a03',
        },
        orange: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#ea580c',
          400: '#ea580c',
          500: '#ea580c',
          600: '#c2410c',
          700: '#9a3412',
          800: '#7c2d12',
          900: '#431407',
        },
        // Blue: ngjyrat e lehta → blu i fortë
        blue: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#1d4ed8',
          400: '#1d4ed8',
          500: '#1d4ed8',
          600: '#1e40af',
          700: '#1e3a8a',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
