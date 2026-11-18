import { cpSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const source = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
mkdirSync(destination, { recursive: true });
for (const folder of ['game', 'screenshots']) {
  cpSync(join(source, folder), join(destination, folder), { recursive: true });
}
if (readdirSync(join(destination, 'screenshots')).length !== 4) throw new Error('Exactly four screenshots required');
const dossier = buildDossier(destination, {
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 }
});
if (dossier.length > 1572864) throw new Error('Dossier exceeds bounty cap');
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log('Packaged Pelabuhan Senja: ' + dossier.length + ' dossier bytes');
