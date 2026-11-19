[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# PELABUHAN SENJA — coastal open-world crime game

An original open-world crime game in the spirit of GTA 6, built for the
make.fun gta6-01 bounty. Raka, a courier for the Lorong Senja crew, runs five
story missions through Pelabuhan Senja — a coastal port city at golden dusk
with a harbor, a night market, an old town and the Tanjung Api lighthouse.

The city is fully procedural (three.js, no external assets): a 300×280
heightfield with six districts, ~45 road-aware buildings with lit windows and
neon signs, palms, grass, rocks and a working harbor. Drive the red GT coupe
(or steal a convertible or a truck), outrun two police interceptors that ram
you while the heat is on, and climb the wanted ladder from 0 to 3 stars.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network
requests — every script, texture and sound is a file under `game/` or a
`data:` URI.

## Controls

- **WASD** drive / move · **mouse** look (pointer lock) · **Shift** run
- **Space** handbrake (drift) / hop · **E** enter / exit car
- **F** melee / fire · **R** reload · **1 / 2 / 3** weapons
- **M** city map · **Esc** pause

## Missions

1. **First Delivery** — $350 · 2. **Market Pickup** — $500 · 3. **Harbor
   Heist** — $800, 2 stars · 4. **Rival Ambush** — $1000, 1 star ·
   5. **The Lighthouse Run** — $1200, 3 stars. Progress saves to
   localStorage; CONTINUE resumes your run from the title screen.

## Sound

All audio is procedural WebAudio: engine hum, a two-tone police siren while
wanted, drift screeches, and a quiet A-minor pentatonic radio arpeggio on
WAVE 88.1 · Neon Drive. Audio starts only after your first click.
