import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project page on GitHub Pages is served under /PresidentsPromises/.
// Override with BASE_PATH for a user/custom-domain deploy (e.g. "/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/PresidentsPromises/',
  plugins: [react()],
});
