import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Short commit id shown on the title screen and in the debug overlay, so a phone
// can confirm it's running the latest deploy.
function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'LOCAL';
  }
}

export default defineConfig(({ command }) => ({
  // Relative asset paths so the build works at https://<user>.github.io/<repo>/
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(command === 'serve' ? 'DEV' : buildId().toUpperCase()),
  },
}));
