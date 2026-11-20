import { copyFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';

const source = new URL('../dist/index.html', import.meta.url);
const destination = new URL('../dist/404.html', import.meta.url);

await copyFile(fileURLToPath(source), fileURLToPath(destination));
