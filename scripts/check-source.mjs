import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { transformWithEsbuild } from 'vite';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => e.isDirectory() ? files(resolve(dir, e.name)) : resolve(dir, e.name)))).flat();
}
const source = (await files('src')).filter((f) => /\.(js|jsx)$/.test(f));
for (const file of source) {
  const text = await readFile(file, 'utf8');
  if (/^(<{7}|={7}|>{7})\s/m.test(text)) throw new Error(`Merge conflict: ${file}`);
  await transformWithEsbuild(text, file, { loader: file.endsWith('.jsx') ? 'jsx' : 'js', jsx: 'automatic' });
  for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    await access(resolve(dirname(file), match[1]));
  }
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8')).packages[''];
for (const key of ['dependencies', 'devDependencies']) {
  if (JSON.stringify(pkg[key]) !== JSON.stringify(lock[key])) throw new Error(`Lockfile ${key} do not match package.json`);
}
console.log(`Checked syntax/imports for ${source.length} modules and lockfile metadata.`);
