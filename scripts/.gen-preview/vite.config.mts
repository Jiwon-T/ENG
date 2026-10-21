import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
export default defineConfig({root: __dirname, plugins: [react(), tailwindcss()], server: {fs: {allow: ['../..']}}});
