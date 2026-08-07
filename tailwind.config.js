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
    },
  },
  plugins: [],
}
