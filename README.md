# PELABUHAN SENJA

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/thesathing/pelabuhan-senja/reward.svg)](https://make.fun/bounty/gta6-01)

Open-world crime game 3D di browser — kota pelabuhan tropis saat senja, dibangun
untuk bounty [Make GTA 6](https://make.fun/bounty/gta6-01) di make.fun.

Di **Pelabuhan Senja**, kota pelabuhan fiktif di tepi laut, kamu mengemudi menyusuri
boulevard pantai, jalan pasar, dan dermaga kontainer saat matahari terbenam:
lalu lintas bergerak, lampu jalan menyala, dan langit oranye-ungu memantul di
kaca mobil. Semua dibuat orisinal — kota, kendaraan, dan cerita milik sendiri,
tanpa aset dari game komersial mana pun.

## Main

Buka `game/index.html` lewat server statis apa pun, atau:

```sh
node serve.ts
# lalu buka http://localhost:8080
```

Kontrol: **WASD / panah** mengemudi, **Spasi** rem, **R** kembali ke titik awal,
**Enter** mulai dari layar judul.

## Teknologi

- [three.js](https://threejs.org/) 0.160.0, divendorkan sebagai
  `game/vendor/three.module.min.js` — game berjalan penuh offline, tanpa satu
  pun request jaringan.
- Semua tekstur digambar prosedural di canvas (`game/src/textures.js`):
  fasad gedung dengan jendela menyala, papan toko, aspal dengan marka jalan,
  pasir, air, papan dermaga, dan atap kios.
- Tanpa build step: `game/` hanya file statis, `main.ts` (Node 22, stdlib saja)
  menyalin `game/` + `screenshots/` ke `/output` dan menulis `dossier.json`.

## Struktur kode

| File | Tugas |
| --- | --- |
| `game/src/main.js` | Bootstrap, game loop, fisika mengemudi, status menu → mengemudi |
| `game/src/world.js` | Kota: pelabuhan, dermaga, pasar, kota tua, pantai, langit senja |
| `game/src/vehicles.js` | Model mobil detail (bodi miring, kaca, roda, lampu) + lalu lintas |
| `game/src/textures.js` | Tekstur prosedural dari canvas |
| `game/src/input.js` | Keyboard + mouse |
| `game/src/render.js` | Kamera chase rendah + tendangan FOV saat ngebut |
| `game/src/config.js` | Konstanta yang bisa di-tune |

## Lisensi

MIT — lihat [LICENSE](LICENSE).
