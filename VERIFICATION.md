# Verification

Final browser results: 46/46 primary checks, 11/11 supplemental system checks, 4/4 deterministic/live-render checks. Total: 61/61. All final suites exited 0. Console/page errors: 0. Failed requests: 0. External requests: 0. The installed develop-web-game client also exited 0 with walking/jumping state and no error artifact.

Primary checks cover four screenshot states and HUD/minimap, world populations, walking/jumping, courier entry, acceleration, steering, handbrake, first-delivery completion using keyboard driving, reward persistence, theft and displaced driver, police spawning, exiting, pause, three-crate pickup, cargo truck theft/chase, paid lay-low, cargo return, five-rival ambush and pistol damage, final chase/victory, free roam, death/retry and Continue.

Supplemental checks cover Hard aggression, foot police, unseen wanted decay, Busted on contact, health supply, reload/reserve accounting, punch damage, fleeing civilians, hill climbing and building collision. Later chapter tests use actor-position fixtures; they do not represent a continuous manual playthrough of the entire story.

Render checks compare two independently loaded seeded driving JPEG captures byte-for-byte and verify walking/driving in the normal requestAnimationFrame loop after starting from the title screenshot mode.

Packaging: 82/82 checks passed, including module syntax and local references, no import map, no authored remote URLs, ordinary files only, output trees byte-identical to input, canonical dossier recomputation and deterministic second packaging run. `npx tsc -p tsconfig.json` passed. Required vendor copies match their authorized sources byte-for-byte.

Game: 11 files, 1 directory, 1,143,992 bytes. Index: 3,276 bytes.
Screenshots: exactly four unedited browser JPEGs, 1280x720:
- 1-start.jpg: 137,640 bytes
- 2-drive.jpg: 107,928 bytes
- 3-chase.jpg: 119,780 bytes
- 4-victory.jpg: 119,560 bytes
Dossier: 711,496 bytes.
Dossier SHA-256: 7551c9de7e896e1ec6765acdcdb7ce6f35aa9ed3c1d7f9fe3d545391e35734d1

Known verification limitation: visual inspection could not run because the image tool returned HTTP 403 client_not_allowed on repeated attempts. The screenshots are real captures, with dimensions, nonempty image data, state and pixel determinism checked, but are not claimed to have been visually reviewed.

Literal constraint conflict: unchanged authorized Three.js files contain upstream documentation URLs, an XHTML namespace and an original-filename comment. These are retained to preserve the requested vendor pair. Actual imports resolve to three.core.min.js; nothing requests three.core.js or an external resource. There are no HTTP(S) URLs in authored game code.

Runtime errors remaining: zero detected by the final suites. Submission, remote publication and competition transcript eligibility were not part of this build verification.
