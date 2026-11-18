# Pelabuhan Senja

An original coastal open-world crime game. Play Raka, courier for Lorong Senja, through five linked jobs in a procedural port city at golden dusk.

## Run

Run `node serve.ts`, then open `http://localhost:8080`. Node 22.18 or newer is sufficient. The game itself is static files: serve `game/` from any static server. There is no build step and no runtime dependency download.

## Controls

WASD: walk / drive. Mouse: orbit and aim. Shift: sprint. E: enter, exit, steal or interact. Space: jump / handbrake. F: punch. Click: pistol. R: reload. Escape: pause. In a car, slow below 22 km/h before getting out. Brake within the gold delivery circle to finish a driving objective.

Follow the gold minimap route. The blue courier car beside the starting position is yours; other cars can trigger a theft report. Civilians flee nearby crimes. Patrols pursue and ram vehicles; foot officers can arrest Raka. Break line of sight for eight seconds per wanted star, or return to the hideout on the southwest side of the market and pay $150 on foot. Health and ammo pickups are beside its door. To use the hideout, stand away from car doors so E selects the hideout instead.

## Story

1. First Delivery — drive the courier package across the market.
2. Market Pickup — collect three crates on foot.
3. Harbor Heist — steal the dock truck, lose the pursuit, and return it.
4. Rival Ambush — defend Lorong Senja against five rivals.
5. The Lighthouse Run — carry the harbor ledger up to Tanjung Api.

Mission completion saves money, difficulty, and progress in localStorage. Retry restarts the current checkpoint. Continue resumes the saved chapter. The city stays open after the finale.

## Architecture

`game/world.js`: procedural geometry, materials, collision, vehicles, characters.
`game/simulation.js`: player actions, theft, combat, wanted response, saves.
`game/traffic.js`: movement, traffic, police pursuit, civilian reactions, pickups.
`game/missions.js`: five-job story and objective transitions.
`game/ui.js`: HUD, minimap, menus and dialogue.
`game/audio.js`: procedural WebAudio ambience and effects.
`game/main.js`: camera, input, deterministic shots and test stepping.

Only Three.js is vendored in the game. Its two minified files were mechanically copied from the authorized vendor pair. The upstream files retain documentation URLs, an XHTML namespace string, and an original-filename comment; none is fetched. The actual module imports `./three.core.min.js`. Authored game code contains no remote URLs.

## Verification and packaging

`npm install` installs development-only Playwright, TypeScript, and Node type definitions. Browser automation uses the full Chromium channel because this host's headless-shell executable crashes at launch.

Run `node tests/play.mjs` and `node tests/systems.mjs` after starting the server. The former captures the four unedited JPEG screenshots and verifies story transitions and inputs. The latter exercises additional gameplay systems. Tests use deterministic time stepping. Later mission checks position actors explicitly to isolate the mission/combat triggers; the first delivery uses keyboard throttle and brake across the market route.

`shots.json` lists start, drive, chase and victory. Each game URL accepts `?shot=NAME&seed=2601`. Screenshot mode holds a composed world state until gameplay input; the normal game remains animated.

Run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`. Packaging uses the unchanged kit helper `vendor/makefun-game.ts` and writes the game, four screenshots and canonical dossier. Generated output and local test artifacts are git-ignored.

All original source is MIT licensed. No commercial game art, names, maps, music or models are used.
