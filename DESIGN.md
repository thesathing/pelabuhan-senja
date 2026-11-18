# PELABUHAN SENJA: Game Design

## Pitch
A third-person courier crime story through an original Indonesian-flavoured harbor city at golden dusk.

## Core loop
Explore the city on foot or drive its traffic; steal or deliver cargo; raise police attention through crime; lose the pursuit, earn cash and advance Lorong Senja's five deliveries.

## Mechanics
WASD movement and steering, mouse orbit/aim, Shift sprint, E interact/enter vehicle, F melee, Space jump/handbrake, click fire, R reload, Escape pause. Stealing and violence raise a five-star wanted level; police pursue until line of sight is broken. Health, money, ammunition and mission progress persist locally.

## Progression
Five sequential missions lead from a simple town delivery to a three-star lighthouse escape. Easy, Normal and Hard change police response and damage. A hideout offers a paid cooldown.

## Art and sound
Offline procedural Three.js realism: displaced terrain, hand-authored canvas material maps, layered architecture, articulated people, shaped vehicles, harbor water, sunset lighting, haze and original synthesized WebAudio cues.

## Rev5 — neon-dusk art direction
Saturated neon dusk replaces the flat golden hour: hot magenta horizon fading to violet and deep blue, a big low sun with additive glow sprites, pink-violet fog, neon shop signs (MARKET, HARBOUR CAFE, FISH STALL, BOAT SUPPLY, ANCHOR BAR), glowing windows in warm pink and cyan, and lamp pools on the streets. The HUD is dense like a real game: mission card with stage bar and next objective, a live police response list during pursuits, big cash, wanted stars, weapon slots, a radio line with big speed and gear, a dialogue card with a canvas-drawn portrait of Mira or Dimas, and a circular minimap with a respect bar. M opens a full city-map screen drawn from the real world layout, with named districts (Pasar Senja, The Harbor, Old Town, Tanjung Api, Dermaga, Pergudangan), the five story jobs with cash and status, a legend and live stats.

## Rev6 — real sports cars, new angles, detailed terrain, richer sound
GT proportions replace the bubble loft: a 5.2-long coupe with a 0.98 roofline, a small low raked glasshouse (hood longer than cabin), splitter, skirts, side intakes, spoiler, diffuser, LED strips and a full-width taillight bar; a convertible with no glass dome and visible seats, and a police interceptor coupe. Wheels are 0.38 radius — the first 0.52 pass made the wheel taller than the body and the cars read as go-karts, so the wheels now tuck under the beltline (wheel/body ratio 0.56, contract-tested both ways) while the truck keeps 0.52. All four screenshot angles are new: a low street-level establishing shot toward the sun, a low front-3/4 hero tracking shot at FOV 40 (camera pulled back to z+9.5 so the whole coupe fits), a low rear chase cam tight behind the truck at FOV 46 with both interceptors and the oncoming car staggered in the left channel so no vehicle hides another, and a low-angle hero shot looking up at Raka on the lighthouse hill. Terrain is instanced grass tufts (1600), rocks, shrubs and flowers, cracked and patched asphalt with oil stains, glossy puddles, manholes, drains, painted curbs, dirt paths and sand near the harbor. Sound adds a two-tone police siren, tire screeches and a quiet procedural radio bed; driving adds brake lights, a speed FOV kick and shake, and a handbrake drift touch. Missions, neon-dusk HUD, city map and all-English text are unchanged.
