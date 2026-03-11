/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        idle: '#22c55e',
        recording: '#ef4444',
        transcribing: '#3b82f6',
        processing: '#8b5cf6',
        error: '#f97316',
        cancelled: '#6b7280',
      },
    },
  },
  plugins: [],
};
