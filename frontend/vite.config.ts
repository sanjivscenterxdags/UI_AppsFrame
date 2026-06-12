/*

** June 10, 2026 DGZ 

VITE server is STRICTLY bind with port 6173
Failure if this port is occupied.

Cybersecurity, Zero Trust NA and AI-Security all will be able to leverage 
this constant value of PORT; in Production, no other port will be allowed. 

*/


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6173,      // Run server on port 6173
    strictPort: true, // Fail if port is occupied
    proxy: {
      '/api': 'http://localhost:8000'  // Forward all /api calls to FastAPI backend
    }
  }
});
