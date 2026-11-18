# Pelabuhan Senja — short GDD

Original open-world crime story. Raka carries contraband for Lorong Senja in a small coastal city at golden dusk. All geometry, dialogue, synthesis and game logic are authored for this entry. Three.js is the sole runtime library.

Core loop: follow a gold route, borrow or steal a car, reach a contact, handle the consequence, earn cash and unlock the next job. The first thirty seconds introduce a nearby courier car and a clear destination along the market avenue. Free roam remains available between objectives.

World: a 280-metre city grid with forty shophouses, a night market, promenades, a container harbor with cranes and boats, and an elevated lighthouse approach. Twelve traffic cars follow junction-aware loops. Twenty civilians walk sidewalks and flee crimes. Building boxes block cars and people; the waterfront prevents driving into the sea.

Controls: WASD walk or drive, Shift sprint, mouse orbit and aim, E interact/steal/enter/exit, F punch, Space jump or handbrake, click pistol, R reload, Escape pause. Cars have acceleration, reverse, steering, friction, damage, lights and a following camera. Foot combat uses aim direction and line of sight. Police use pursuit, ramming and close arrest; difficulty scales pursuit and damage.

Progression: First Delivery (courier car and cross-town drop), Market Pickup (three on-foot crates), Harbor Heist (steal the dock truck and lose two stars), Rival Ambush (defend the hideout), The Lighthouse Run (deliver through a three-star chase). Each job has dialogue, an objective, a completion panel, cash and a saved checkpoint. Death/arrest retries the current job. Hiding breaks sight and drains heat; the hideout offers paid lay-low and health/ammo supplies.

States: title -> playing <-> paused -> job complete -> playing; playing -> busted/wasted -> retry; fifth completion -> victory -> free roam. Local storage persists money, difficulty and mission progress; failures do not destroy the checkpoint.

Art: warm apricot sky, deep teal sea, terracotta roofs, faded pastel plaster, amber windows and electric mint/rose market signs. Strong silhouettes, faceted palms, lantern strings, dock cranes and lighthouse beams. HUD uses restrained dark glass, ivory type and gold mission accents. Four deterministic seeded compositions: start, drive, chase, victory.

Audio: procedural WebAudio engine, tires, gun/impact transients, harbor wind and dusk chimes. Audio begins only on user gesture. Pause quiets the engine.

Implementation: static ES modules, no build, no remote resources. Separate world/model generation, audio, simulation, missions and UI. Delta-clamped frame updates plus deterministic test stepping and text-state inspection. Test actual keyboard input, each mission transition, theft/police, save/retry, combat and all screenshot modes in Playwright. Capture four unedited 1280x720 JPEGs and build the official dossier with the unmodified kit helper.
