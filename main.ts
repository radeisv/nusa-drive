// Nusa Drive for make.fun's gta6-01 (Node 22, stdlib only). game/ is plain static
// files a browser loads offline (index.html + ES modules, three.js vendored under
// game/vendor/, no network); this program copies game/ and screenshots/ to /output
// and writes /output/dossier.json with the vendored make.fun library, guarding the
// hand-in first: index.html exists, game/ inside its file/byte caps, 3-4 screenshots
// inside their size cap. It logs a short build summary at the end.
//
// Serve locally: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Agent-written build guard (Nusa Drive v2): refuse a broken hand-in early. ---
const GAME_DIR = join(here, 'game');
const SHOTS_DIR = join(here, 'screenshots');
const INDEX_HTML = join(GAME_DIR, 'index.html');
const CAPS = { gameEntries: 993, gameBytes: 48 * 1024 * 1024, shots: 4, shotBytes: 256 * 1024 };

function guard(condition, message) {
  if (!condition) throw new Error(`Nusa Drive build guard: ${message}`);
}

guard(existsSync(INDEX_HTML), 'game/index.html is missing, nothing to hand in.');

// Count the game tree the way the gate counts it: files/dirs under game/,
// no symlinks, at most 993 entries and 48 MiB in all.
function countGameTree(dir) {
  let files = 0;
  let bytes = 0;
  let entries = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    entries += 1;
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const stats = statSync(path);
      entries += 1;
      if (stats.isDirectory()) stack.push(path);
      else if (stats.isFile()) {
        files += 1;
        bytes += stats.size;
      } else {
        throw new Error(`Nusa Drive build guard: ${path} is neither a file nor a directory.`);
      }
    }
  }
  return { files, bytes, entries };
}
const gameTotals = countGameTree(GAME_DIR);
guard(gameTotals.entries <= CAPS.gameEntries, `game/ has ${gameTotals.entries} entries, over the 993 cap.`);
guard(gameTotals.bytes <= CAPS.gameBytes, `game/ is ${gameTotals.bytes} bytes, over the 48 MiB cap.`);

// Screenshots: 3 or 4 images, each at most 256 KiB, the first by name the cover.
const shotNames = existsSync(SHOTS_DIR)
  ? readdirSync(SHOTS_DIR).filter((name) => !name.startsWith('.')).sort()
  : [];
guard(shotNames.length >= 3 && shotNames.length <= CAPS.shots, `screenshots/ holds ${shotNames.length} images, need 3 or 4.`);
for (const name of shotNames) {
  const size = statSync(join(SHOTS_DIR, name)).size;
  guard(size <= CAPS.shotBytes, `screenshots/${name} is ${size} bytes, over the 256 KiB cap.`);
}

mkdirSync(out, { recursive: true });
cpSync(GAME_DIR, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(SHOTS_DIR)) cpSync(SHOTS_DIR, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// --- Agent-written build summary (Nusa Drive v2): what this run handed in. ---
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log([
  'Nusa Drive build summary:',
  `  game files: ${gameTotals.files} files, ${gameTotals.bytes} bytes, ${gameTotals.entries} entries`,
  `  screenshots: ${shotNames.join(', ')}`,
  `  dossier.json: ${dossierBytes} bytes (cap 163840)`,
  `  output: ${out}`,
].join('\n'));
