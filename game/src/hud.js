// PELABUHAN SENJA — HUD: speed, cash, health/armour, wanted stars,
// mission objective with live distance, crew dialogue, and a minimap.
//
// Everything is drawn big and high-contrast on purpose: the HUD has to stay
// readable when a screenshot is shrunk to a thumbnail. The minimap is a
// real 2D canvas — roads, the pier and the sea, the player arrow, police
// dots, the mission marker, and an N for north — redrawn every frame from
// the live game state.

import { WORLD } from './config.js';

// Minimap world bounds: the whole city slab plus the pier reaching south.
// North (-Z) is up on the map.
const MAP = { minX: -165, maxX: 165, minZ: -165, maxZ: 245 };
const MAP_SCALE = 190 / (MAP.maxZ - MAP.minZ);
const MAP_OFFSET_X = (190 - (MAP.maxX - MAP.minX) * MAP_SCALE) / 2;

function mapX(x) {
  return MAP_OFFSET_X + (x - MAP.minX) * MAP_SCALE;
}
function mapY(z) {
  return (z - MAP.minZ) * MAP_SCALE;
}

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.speedEl = document.getElementById('hud-speed');
    this.cashEl = document.getElementById('hud-cash');
    this.healthEl = document.getElementById('hud-health');
    this.armourEl = document.getElementById('hud-armour');
    this.wantedEl = document.getElementById('hud-wanted');
    this.jobEl = document.getElementById('hud-job');
    this.objectiveEl = document.getElementById('hud-objective-text');
    this.distanceEl = document.getElementById('hud-distance');
    this.objectiveBox = document.getElementById('hud-objective');
    this.dialogueEl = document.getElementById('hud-dialogue');
    this.hintEl = document.getElementById('hud-hint');

    this.minimap = document.getElementById('hud-minimap');
    this.ctx = this.minimap.getContext('2d');

    this._dialogueQueue = [];
    this._dialogueTimer = 0;
    this._lastStars = -1;
    this._time = 0;
  }

  // The whole HUD stays hidden behind the title menu and appears when
  // driving starts, so the menu shot is clean.
  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  setHint(text) {
    this.hintEl.textContent = text;
  }

  // Crew lines queue up and show one at a time, centre-bottom, long enough
  // to read at a glance.
  showDialogue(text, ms = 4600) {
    this._dialogueQueue.push({ text, ms });
  }

  _updateDialogue(dt) {
    if (this._dialogueTimer > 0) {
      this._dialogueTimer -= dt * 1000;
      if (this._dialogueTimer <= 0) this.dialogueEl.classList.add('hidden');
      return;
    }
    const next = this._dialogueQueue.shift();
    if (!next) return;
    this.dialogueEl.textContent = next.text;
    this.dialogueEl.classList.remove('hidden');
    this._dialogueTimer = next.ms;
  }

  update(dt, state) {
    this._time += dt;
    this._updateDialogue(dt);

    this.speedEl.textContent = `${Math.round(state.speedKmh)} km/j`;
    this.cashEl.textContent = `$${state.cash}`;
    this.healthEl.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    this.armourEl.style.width = `${Math.max(0, Math.min(100, state.armour))}%`;

    if (state.stars !== this._lastStars) {
      this._lastStars = state.stars;
      this.wantedEl.textContent =
        state.stars > 0 ? '★'.repeat(state.stars) + '☆'.repeat(5 - state.stars) : '';
      this.wantedEl.classList.toggle('hidden', state.stars === 0);
    }

    const obj = state.objective;
    this.jobEl.textContent = obj.label;
    this.objectiveEl.textContent = obj.text;
    this.distanceEl.textContent =
      obj.distance === null || obj.distance === undefined ? '' : `${Math.round(obj.distance)} m`;

    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.ctx;
    const W = 190;
    const H = 190;
    ctx.clearRect(0, 0, W, H);

    // City ground.
    ctx.fillStyle = '#171231';
    ctx.fillRect(0, 0, W, H);

    // Sea along the south edge, then the beach strip.
    ctx.fillStyle = '#1d3a5e';
    ctx.fillRect(0, mapY(WORLD.seaStart), W, H - mapY(WORLD.seaStart));
    ctx.fillStyle = '#5a4a34';
    ctx.fillRect(0, mapY(WORLD.beachStart), W, mapY(WORLD.seaStart) - mapY(WORLD.beachStart));

    // Roads: the grid the player actually drives on.
    ctx.strokeStyle = '#9a8a72';
    ctx.lineWidth = Math.max(3, WORLD.roadWidth * MAP_SCALE);
    ctx.lineCap = 'round';
    for (let v = WORLD.roadFirst; v <= WORLD.roadLast; v += WORLD.roadSpacing) {
      ctx.beginPath();
      ctx.moveTo(mapX(v), mapY(-WORLD.halfSize));
      ctx.lineTo(mapX(v), mapY(WORLD.halfSize));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mapX(-WORLD.halfSize), mapY(v));
      ctx.lineTo(mapX(WORLD.halfSize), mapY(v));
      ctx.stroke();
    }

    // The pier reaching out over the sea.
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(mapX(85.5), mapY(150), mapX(94.5) - mapX(85.5), mapY(234) - mapY(150));

    // Mission marker: a pulsing amber diamond with a white edge.
    const target = state.target;
    if (target) {
      const pulse = 1 + 0.25 * Math.sin(this._time * 4);
      const tx = mapX(target.x);
      const ty = mapY(target.z);
      const r = 7 * pulse;
      ctx.beginPath();
      ctx.moveTo(tx, ty - r);
      ctx.lineTo(tx + r, ty);
      ctx.lineTo(tx, ty + r);
      ctx.lineTo(tx - r, ty);
      ctx.closePath();
      ctx.fillStyle = '#ffb52e';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Police cruisers: red dots with a white ring; the helicopter, if any,
    // is a larger orange dot.
    for (const dot of state.policeDots) {
      ctx.beginPath();
      ctx.arc(mapX(dot.x), mapY(dot.z), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b30';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    if (state.heli) {
      ctx.beginPath();
      ctx.arc(mapX(state.heli.x), mapY(state.heli.z), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a1f';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Player: a white arrow that turns with the car's heading.
    const px = mapX(state.player.x);
    const py = mapY(state.player.z);
    const fx = -Math.sin(state.player.heading);
    const fy = -Math.cos(state.player.heading);
    const angle = Math.atan2(fx, -fy);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#14102a';
    ctx.stroke();
    ctx.restore();

    // North indicator, top centre, so the map always orients at a glance.
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('N', W / 2, 4);

    // Frame.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 210, 122, 0.85)';
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  }
}
