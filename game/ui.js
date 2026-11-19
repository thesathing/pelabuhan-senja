// PELABUHAN SENJA — dense live HUD, title screen, pause, city map, cards.
// DOM only (no three.js). Pure helpers (formatCash, wantedStars, policeStatus)
// are exported for Node tests; everything else needs a document.

export function formatCash(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

export function wantedStars(n) {
  const filled = Math.max(0, Math.min(5, n));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Police list status: RAMMING on contact, ROADBLOCK when a unit sits ahead of
// the player within 35 m, PURSUIT while wanted, PATROL when the heat is off.
export function policeStatus(p, player, wanted) {
  if (!wanted) return 'PATROL';
  if (p.contact) return 'RAMMING';
  const dx = p.x - player.x, dz = p.z - player.z;
  const dist = Math.hypot(dx, dz);
  const ahead = dx * Math.sin(player.heading) + dz * Math.cos(player.heading);
  if (ahead > 0 && dist < 35) return 'ROADBLOCK';
  return 'PURSUIT';
}

const PORTRAIT_COLORS = {
  Raka: { bg: '#1f6f8b', skin: '#c98d5f', hair: '#1a1210', shirt: '#2b6cb0' },
  Mira: { bg: '#7a2a5e', skin: '#d9a06b', hair: '#241018', shirt: '#b03080' },
  Dimas: { bg: '#2a4a2a', skin: '#b98a5e', hair: '#101010', shirt: '#3a5a3a' },
};

// Small geometric canvas portrait (no assets).
export function drawPortrait(canvas, speaker) {
  const c = PORTRAIT_COLORS[speaker] || PORTRAIT_COLORS.Raka;
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.fillStyle = c.bg;
  g.fillRect(0, 0, w, h);
  // Shoulders / shirt.
  g.fillStyle = c.shirt;
  g.beginPath();
  g.moveTo(6, h); g.lineTo(w - 6, h); g.lineTo(w - 14, h * 0.62); g.lineTo(14, h * 0.62);
  g.closePath(); g.fill();
  // Face.
  g.fillStyle = c.skin;
  g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.24, 0, Math.PI * 2); g.fill();
  // Hair.
  g.fillStyle = c.hair;
  if (speaker === 'Mira') {
    g.beginPath(); g.arc(w / 2, h * 0.34, w * 0.26, Math.PI, 0); g.fill();
    g.fillRect(w * 0.2, h * 0.3, w * 0.08, h * 0.5);
    g.fillRect(w * 0.72, h * 0.3, w * 0.08, h * 0.5);
    g.fillStyle = '#ff4fd8';
    g.fillRect(w * 0.3, h * 0.22, w * 0.4, h * 0.05);
  } else if (speaker === 'Dimas') {
    g.beginPath(); g.arc(w / 2, h * 0.36, w * 0.25, Math.PI, 0); g.fill();
    g.fillRect(w * 0.24, h * 0.3, w * 0.52, h * 0.06); // cap brim
    g.fillStyle = c.hair;
    g.beginPath(); g.arc(w / 2, h * 0.56, w * 0.16, 0, Math.PI); g.fill(); // beard
  } else {
    g.beginPath(); g.arc(w / 2, h * 0.34, w * 0.25, Math.PI, 0); g.fill();
  }
  // Eyes.
  g.fillStyle = '#14100c';
  g.fillRect(w * 0.38, h * 0.4, w * 0.05, h * 0.04);
  g.fillRect(w * 0.57, h * 0.4, w * 0.05, h * 0.04);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createHUD({ hudEl, titleEl, callbacks }) {
  const cb = callbacks || {};
  let mapOpen = false;
  let dialogueTimer = null;

  // --- HUD skeleton (inside #hud, pointer-events none except buttons). ---
  const missionCard = el('div', 'panel hud-mission');
  missionCard.innerHTML = '<div class="hud-chapter"></div><div class="hud-title"></div>'
    + '<div class="hud-objective"></div><div class="hud-stagebar"><div class="hud-stagefill"></div></div>'
    + '<div class="hud-stage"></div><div class="hud-next"></div>';
  const policeCard = el('div', 'panel hud-police');
  const cashCard = el('div', 'panel hud-cash');
  const speedCard = el('div', 'hud-speed');
  const minimapWrap = el('div', 'hud-minimap-wrap');
  const minimap = document.createElement('canvas');
  minimap.width = 168; minimap.height = 168;
  minimapWrap.appendChild(minimap);
  const respectWrap = el('div', 'hud-respect');
  const dialogueCard = el('div', 'panel hud-dialogue');
  const portrait = document.createElement('canvas');
  portrait.width = 56; portrait.height = 56;
  portrait.className = 'hud-portrait';
  const dialogueText = el('div', 'hud-dialogue-text');
  dialogueCard.appendChild(portrait);
  dialogueCard.appendChild(dialogueText);
  dialogueCard.style.display = 'none';

  // Center cards (complete / failed / paused).
  const centerCard = el('div', 'panel hud-center');
  centerCard.style.display = 'none';
  const mapOverlay = el('div', 'panel hud-map');
  mapOverlay.style.display = 'none';
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 520; mapCanvas.height = 500;
  const mapJobsEl = el('div', 'hud-map-jobs');
  const mapStatsEl = el('div', 'hud-map-stats');
  const mapClose = el('button', 'hud-btn', 'CLOSE  [M]');
  mapClose.addEventListener('click', () => { hideMap(); cb.onCloseMap && cb.onCloseMap(); });
  mapOverlay.appendChild(mapCanvas);
  const mapSide = el('div', 'hud-map-side');
  mapSide.appendChild(el('div', 'hud-map-title', 'CITY MAP — PELABUHAN SENJA'));
  mapSide.appendChild(mapJobsEl);
  mapSide.appendChild(mapStatsEl);
  mapSide.appendChild(mapClose);
  mapOverlay.appendChild(mapSide);

  hudEl.append(missionCard, policeCard, cashCard, speedCard, minimapWrap, respectWrap, dialogueCard, centerCard, mapOverlay);

  // --- Title screen (inside #title). ---
  titleEl.innerHTML = '';
  const titleInner = el('div', 'title-inner');
  titleInner.innerHTML = '<div class="title-kicker">A LORONG SENJA STORY</div>'
    + '<h1 class="title-main neon">PELABUHAN<br>SENJA</h1>'
    + '<div class="title-tag">The city keeps its own hours.</div>'
    + '<p class="title-story">Raka runs one last delivery through the harbor district. '
    + 'Keep moving, keep your head down, and watch who follows.</p>';
  const diffRow = el('div', 'title-diff');
  let difficulty = 'NORMAL';
  const diffBtns = {};
  for (const d of ['EASY', 'NORMAL', 'HARD']) {
    const b = el('button', 'hud-btn title-diff-btn' + (d === 'NORMAL' ? ' active' : ''), d);
    b.addEventListener('click', () => {
      difficulty = d;
      for (const k of Object.keys(diffBtns)) diffBtns[k].classList.toggle('active', k === d);
      cb.blip && cb.blip();
    });
    diffBtns[d] = b;
    diffRow.appendChild(b);
  }
  const startBtn = el('button', 'hud-btn title-start', 'START RUN');
  startBtn.addEventListener('click', () => cb.onStart && cb.onStart(difficulty));
  const continueBtn = el('button', 'hud-btn title-start', 'CONTINUE');
  continueBtn.style.display = 'none';
  continueBtn.addEventListener('click', () => cb.onContinue && cb.onContinue());
  const controls = el('div', 'title-controls',
    'WASD MOVE / DRIVE · MOUSE LOOK · E ENTER / EXIT · SPACE HANDBRAKE · '
    + 'F MELEE · CLICK FIRE · R RELOAD · 1 / 2 WEAPON · M CITY MAP · ESC PAUSE');
  titleInner.append(diffRow, startBtn, continueBtn, controls);
  titleEl.appendChild(titleInner);

  function showCenter(html, buttons) {
    centerCard.innerHTML = html;
    for (const [label, fn] of buttons) {
      const b = el('button', 'hud-btn', label);
      b.addEventListener('click', fn);
      centerCard.appendChild(b);
    }
    centerCard.style.display = 'block';
  }

  function hideCenter() { centerCard.style.display = 'none'; }

  function hideMap() {
    mapOpen = false;
    mapOverlay.style.display = 'none';
  }

  return {
    get mapOpen() { return mapOpen; },
    setMission({ chapter, title, objective, stageLabel, stageIndex, stageTotal, nextTitle }) {
      missionCard.querySelector('.hud-chapter').textContent = chapter;
      missionCard.querySelector('.hud-title').textContent = title;
      missionCard.querySelector('.hud-objective').textContent = objective;
      missionCard.querySelector('.hud-stage').textContent = stageLabel;
      const pct = stageTotal > 0 ? Math.round((stageIndex / stageTotal) * 100) : 0;
      missionCard.querySelector('.hud-stagefill').style.width = `${pct}%`;
      missionCard.querySelector('.hud-next').textContent = nextTitle ? `NEXT: ${nextTitle}` : 'NEXT: FREE ROAM';
    },
    setPolice(list, wanted) {
      if (!wanted) {
        policeCard.innerHTML = '<div class="hud-police-head">POLICE RESPONSE · 0 UNITS · CODE 0</div>'
          + '<div class="hud-police-row">No units on you. Stay clean.</div>';
        return;
      }
      let html = `<div class="hud-police-head">POLICE RESPONSE · ${list.length} UNITS · CODE ${wanted}</div>`;
      for (const p of list) {
        html += `<div class="hud-police-row"><span>${p.callsign}</span><span>${Math.round(p.dist)} m</span>`
          + `<span class="hud-status-${p.status}">${p.status}</span></div>`;
      }
      policeCard.innerHTML = html;
    },
    setCash(cash, health, maxHealth, wanted) {
      cashCard.innerHTML = `<div class="hud-cash-amount">${formatCash(cash)}</div>`
        + `<div class="hud-wanted">${wantedStars(wanted)}</div>`
        + `<div class="hud-health"><div class="hud-healthfill" style="width:${Math.round((health / maxHealth) * 100)}%"></div></div>`
        + `<div class="hud-health-label">HEALTH ${Math.max(0, Math.round(health))}</div>`;
    },
    setWeapons({ weapon, ammo, reserve, smgLocked }) {
      const slots = [
        { name: 'FISTS', active: weapon === 'FISTS', label: 'FISTS' },
        { name: 'PISTOL', active: weapon === 'PISTOL', label: `${ammo} / ${reserve}` },
        { name: 'SMG', active: weapon === 'SMG', label: smgLocked ? 'SMG · LOCKED' : 'SMG' },
      ];
      let html = '<div class="hud-weapons">';
      for (const s of slots) html += `<span class="hud-weapon${s.active ? ' active' : ''}">${s.label}</span>`;
      html += '</div>';
      // Keep the weapons row attached under the cash card.
      let row = cashCard.querySelector('.hud-weapons');
      if (!row) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        cashCard.appendChild(tmp.firstChild);
      } else {
        row.outerHTML = html;
      }
    },
    setSpeed(kmh, driving) {
      speedCard.innerHTML = `<div class="hud-radio">WAVE 88.1 · Neon Drive</div>`
        + `<div class="hud-speed-num">${Math.round(kmh)}</div><div class="hud-speed-unit">KM/H</div>`
        + `<div class="hud-speed-mode">${driving ? 'DRIVE' : 'ON FOOT'}</div>`;
    },
    setRespect(respect) {
      respectWrap.innerHTML = `<div class="hud-respect-label">RESPECT ${respect}</div>`
        + `<div class="hud-respect-bar"><div class="hud-respect-fill" style="width:${respect * 10}%"></div></div>`;
    },
    showDialogue(speaker, text) {
      drawPortrait(portrait, speaker);
      dialogueText.innerHTML = `<div class="hud-dialogue-speaker">${speaker}</div><div>${text}</div>`;
      dialogueCard.style.display = 'flex';
      if (dialogueTimer) window.clearTimeout(dialogueTimer);
      dialogueTimer = window.setTimeout(() => { dialogueCard.style.display = 'none'; }, 5000);
    },
    hideDialogue() {
      dialogueCard.style.display = 'none';
      if (dialogueTimer) window.clearTimeout(dialogueTimer);
    },
    drawMinimap({ playerX, playerZ, heading, police, objective, districts, roads }) {
      const g = minimap.getContext('2d');
      const S = 168;
      const sx = (x) => ((x + 150) / 300) * S;
      const sz = (z) => ((z + 140) / 280) * S;
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#12081f';
      g.fillRect(0, 0, S, S);
      // Districts.
      const colors = ['#2a1a3a', '#3a1a2e', '#1a2a3a', '#2e2a1a', '#1a3a2e', '#33241a'];
      districts.forEach((d, i) => {
        g.fillStyle = colors[i % colors.length];
        for (const [x1, z1, x2, z2] of d.rects) g.fillRect(sx(x1), sz(z1), sx(x2) - sx(x1), sz(z2) - sz(z1));
      });
      // Roads.
      g.strokeStyle = 'rgba(245, 238, 252, 0.35)';
      g.lineWidth = 2;
      for (const r of roads) {
        g.beginPath(); g.moveTo(sx(r.ax), sz(r.az)); g.lineTo(sx(r.bx), sz(r.bz)); g.stroke();
      }
      // Lighthouse.
      g.fillStyle = '#f2c14e';
      g.beginPath(); g.arc(sx(105), sz(-95), 3, 0, Math.PI * 2); g.fill();
      // Objective.
      if (objective) {
        const pulse = 4 + Math.sin(Date.now() / 300) * 1.5;
        g.fillStyle = '#ffd34e';
        g.beginPath(); g.arc(sx(objective.x), sz(objective.z), pulse, 0, Math.PI * 2); g.fill();
      }
      // Police.
      for (const p of police) {
        g.fillStyle = '#ff4f6a';
        g.beginPath(); g.arc(sx(p.x), sz(p.z), 3, 0, Math.PI * 2); g.fill();
      }
      // Player arrow.
      g.save();
      g.translate(sx(playerX), sz(playerZ));
      g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) * -1 + Math.PI);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
      g.restore();
    },
    showTitle({ hasSave }) {
      titleEl.style.display = 'block';
      continueBtn.style.display = hasSave ? 'inline-block' : 'none';
    },
    hideTitle() { titleEl.style.display = 'none'; },
    showPause({ onResume, onRetry, onQuit }) {
      showCenter('<div class="hud-center-kicker">PAUSED</div><div class="hud-center-title">TAKE A BREATH</div>'
        + '<div class="hud-center-text">The city waits. Your run is saved.</div>', [
        ['RESUME', () => { hideCenter(); onResume && onResume(); }],
        ['RESTART MISSION', () => { hideCenter(); onRetry && onRetry(); }],
        ['QUIT TO TITLE', () => { hideCenter(); onQuit && onQuit(); }],
      ]);
    },
    showComplete({ mission, cash, nextTitle, allDone }) {
      showCenter(`<div class="hud-center-kicker">${mission.chapter}</div>`
        + '<div class="hud-center-title">DELIVERY COMPLETE</div>'
        + `<div class="hud-center-text">${mission.title} — ${formatCash(mission.reward)} earned. Cash ${formatCash(cash)}.</div>`, allDone
        ? [['KEEP DRIVING', () => { hideCenter(); cb.onNext && cb.onNext(); }]]
        : [['NEXT MISSION', () => { hideCenter(); cb.onNext && cb.onNext(); }]]);
    },
    showFailed({ mission, reason }) {
      showCenter(`<div class="hud-center-kicker">${mission.chapter}</div>`
        + `<div class="hud-center-title">${reason === 'BUSTED' ? 'BUSTED' : 'MISSION FAILED'}</div>`
        + `<div class="hud-center-text">${mission.title} — the cops got you. The crew will cover the bail. Try again.</div>`, [
        ['RETRY MISSION', () => { hideCenter(); cb.onRetry && cb.onRetry(); }],
        ['QUIT TO TITLE', () => { hideCenter(); cb.onQuit && cb.onQuit(); }],
      ]);
    },
    hideCards() { hideCenter(); },
    showMap({ jobs, stats, districts, roads, playerX, playerZ, objective }) {
      mapOpen = true;
      mapOverlay.style.display = 'flex';
      const g = mapCanvas.getContext('2d');
      const W = 520, H = 500;
      const sx = (x) => ((x + 150) / 300) * W;
      const sz = (z) => ((z + 140) / 280) * H;
      g.fillStyle = '#12081f';
      g.fillRect(0, 0, W, H);
      const colors = ['#2a1a3a', '#3a1a2e', '#1a2a3a', '#2e2a1a', '#1a3a2e', '#33241a'];
      districts.forEach((d, i) => {
        g.fillStyle = colors[i % colors.length];
        for (const [x1, z1, x2, z2] of d.rects) g.fillRect(sx(x1), sz(z1), sx(x2) - sx(x1), sz(z2) - sz(z1));
        g.fillStyle = 'rgba(245, 238, 252, 0.75)';
        g.font = 'bold 13px system-ui, sans-serif';
        const [x1, z1] = d.rects[0];
        g.fillText(d.name, sx(x1) + 8, sz(z1) + 20);
      });
      g.strokeStyle = 'rgba(245, 238, 252, 0.4)';
      g.lineWidth = 2;
      for (const r of roads) {
        g.beginPath(); g.moveTo(sx(r.ax), sz(r.az)); g.lineTo(sx(r.bx), sz(r.bz)); g.stroke();
      }
      // Job markers (numbered) at each job's final stage.
      g.font = 'bold 12px system-ui, sans-serif';
      jobs.forEach((job, i) => {
        const st = jobStages[job.id];
        if (!st) return;
        g.fillStyle = job.status === 'DONE' ? '#7ddc8a' : job.status === 'ACTIVE' ? '#ffd34e' : '#f5eefc';
        g.beginPath(); g.arc(sx(st.x), sz(st.z), 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#12081f';
        g.fillText(String(i + 1), sx(st.x) - 3.5, sz(st.z) + 4);
      });
      if (objective) {
        g.fillStyle = '#ffd34e';
        g.beginPath(); g.arc(sx(objective.x), sz(objective.z), 5, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(sx(playerX), sz(playerZ), 5, 0, Math.PI * 2); g.fill();
      // Job list.
      mapJobsEl.innerHTML = jobs.map((job, i) => `<div class="hud-map-job">`
        + `<span class="hud-map-job-num">${i + 1}</span><span class="hud-map-job-title">${job.chapter} · ${job.title}</span>`
        + `<span>${formatCash(job.cash)}</span><span class="hud-map-job-status">${job.status}</span></div>`).join('')
        + `<div class="hud-map-legend">LEGEND — gold: active job · green: done · white: locked · white dot: you</div>`;
      mapStatsEl.innerHTML = `<div>CASH ${formatCash(stats.cash)}</div><div>RESPECT ${stats.respect} / 10</div>`
        + `<div>MISSIONS ${stats.missionsDone} / ${stats.missionsTotal}</div><div>WANTED ${wantedStars(stats.wanted)}</div>`;
    },
    hideMap,
  };
}

// Final-stage coordinates for the map markers (mirrors missions.js).
const jobStages = {
  'first-delivery': { x: 100, z: 40 },
  'market-pickup': { x: 50, z: 90 },
  'harbor-heist': { x: -120, z: 0 },
  'rival-ambush': { x: -50, z: 120 },
  'lighthouse-run': { x: 105, z: -95 },
};
