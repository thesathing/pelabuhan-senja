# PELABUHAN SENJA — design note (round 3, part 1)

An original coastal port city at golden dusk, in the spirit of GTA 6. The
player is Raka, a courier for the Lorong Senja smuggler crew. The city has six
districts (Old Town, Pasar Senja night market, Dermaga piers, Pergudangan
warehouses, The Harbor, Tanjung Api lighthouse hill), a 300x280 heightfield
with a 31-high lighthouse hill and a sea coast to the east, and a neon-dusk
art direction: magenta-violet sky, pink fog, one big low sun in the west with
a camera-following glow, stylised clouds.

Everything is procedural and offline: three.js 0.187.0 vendored as two
minified files, no external assets, no network requests. The world layout
(world-data.js) is pure and seeded, so the city is identical on every load
and fully Node-testable; world.js and scene-detail.js only turn it into
meshes. Buildings are road-aware (never on a road), with windowed facades on
all faces, parapets, AC units, antennas and five emissive neon signs. Terrain
detail is instanced for performance: 1600 grass tufts, shrubs, flowers, 220
rocks, 95 palms, dirt paths, and dressed asphalt (cracks, patches, oil,
puddles, manholes, drains, curbs, worn lane markings).

Parts 2-4 add vehicles and driving, the five missions, the dense HUD, the
city map, procedural sound, and the four screenshots.
