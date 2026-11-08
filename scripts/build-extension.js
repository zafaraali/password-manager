import { build } from 'vite';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
await build({ base: './', build: { target: 'chrome120', outDir: 'dist-extension', rollupOptions: { input: { main: 'index.html', popup: 'popup.html' } } } });
await copyFile('extension/manifest.json', 'dist-extension/manifest.json');
const html = await readFile('dist-extension/index.html', 'utf8');
await writeFile('dist-extension/index.html', html.replace(/<link[^>]+(?:rel="manifest"|fonts.googleapis.com)[^>]*>/g, ''));
console.log('Load dist-extension as an unpacked extension in Chrome or Edge.');
