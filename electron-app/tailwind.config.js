/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        idle: '#169976',
        recording: '#e85d50',
        transcribing: '#4675d8',
        processing: '#c38b36',
        error: '#d97745',
        cancelled: '#7a817d',
      },
    },
  },
  plugins: [],
};
