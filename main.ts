// PELABUHAN SENJA — entrypoint (Node 22, standard library only).
//
// What this program does, nothing more: it takes the game in game/ and the
// screenshots in screenshots/ from beside this file, copies both into the
// output directory, and writes output/dossier.json with the make.fun library
// from vendor/makefun-game.ts. The game itself (part D: combat, save/load
// and synthesised audio in game/src/combat.js, save.js and audio.js, plus
// on-foot play wired through game/src/main.js) is plain static files; this
// program never runs it, it only hands the tree in. The grader runs it twice and the two runs
// must produce byte-identical output, so nothing here depends on the clock,
// on randomness, or on the working directory: every path is resolved from
// this file's own URL, and the only knob is MAKEFUN_OUTPUT_DIR (which stands
// in for /output outside the grader).
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The caps the scorer enforces (gate.json): only text_max_bytes shapes the
// dossier bytes; the rest make this program refuse exactly where the scorer
// would refuse the entry, so a bad tree fails loudly here instead of later.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function main(): void {
  const root = repoRoot();
  const out = outputDir();

  // Start from a clean slate so a stale file from an earlier run can never
  // leak into this one and break the byte-identical guarantee.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  copyTree(join(root, 'game'), join(out, 'game'));

  const shots = join(root, 'screenshots');
  if (existsSync(shots)) copyTree(shots, join(out, 'screenshots'));

  const dossier = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
}

main();
