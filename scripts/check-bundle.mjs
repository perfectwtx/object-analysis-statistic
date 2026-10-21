import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const dir = resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(await readFile(resolve(dir, '.vite/manifest.json'), 'utf8'));
const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entry) throw new Error('Build entry missing');
const visited = new Set();
function walk(key) {
  if (visited.has(key)) return;
  visited.add(key); (manifest[key].imports || []).forEach(walk);
}
walk(entry);
const initialFiles = [...visited].map((key) => manifest[key].file);
const bytes = (await Promise.all(initialFiles.map((file) => stat(resolve(dir, file))))).reduce((sum, s) => sum + s.size, 0);
console.log(`Initial JS: ${(bytes / 1024).toFixed(1)} KiB (${initialFiles.length} files). Budget: 350 KiB.`);
if (bytes > 350 * 1024) throw new Error('Initial JS budget exceeded');
if (![...Object.values(manifest)].some((entry) => entry.isDynamicEntry)) throw new Error('Lazy route chunks missing');
