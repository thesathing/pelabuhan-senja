// PELABUHAN SENJA — missions: the four "Kru Senja" jobs.
//
// One story thread across four jobs: pick up a package at Pier 2, deliver
// it to the harbour warehouse, run from the law to the old town, then close
// the night back at the pier. Each job has a destination with a light-pillar
// beacon and a ground ring, a live distance readout, dialogue from the crew,
// a cash reward, and progression to the next job. Getting busted or wrecking
// the car fails the current job and restarts it — the crew does not give up
// on a job, and neither does the city.

import * as THREE from '../vendor/three.module.min.js';

// The four jobs, in story order. Destinations sit on roads or open ground
// the car can actually reach: the pier mouth (90, 143), the warehouse front
// on the harbour road (30, 120), and the old-town road (-108, -120). The
// pier deck itself is fenced off, so "Dermaga 2" means its mouth, where the
// boats tie up.
const JOBS = [
  {
    id: 1,
    name: 'SENJA RUN',
    reward: 400,
    dest: { x: 90, z: 143 },
    radius: 7,
    objective: 'Jemput paket di Dermaga 2',
    briefing: [
      'RAKA: "Paket sudah di Dermaga 2. Ambil sebelum kapal terakhir berangkat."',
      'SARI: "Jangan ngebut di boulevard — polisi lagi rajin malam ini."',
    ],
    arrive: ['Paket di tangan. Kru Senja resmi jalan malam ini.'],
    complete: 'JOB 1 SELESAI — paket aman. +$400',
  },
  {
    id: 2,
    name: 'ANTAR GUDANG',
    reward: 650,
    dest: { x: 30, z: 120 },
    radius: 7,
    objective: 'Antar paket ke Gudang 1 pelabuhan',
    briefing: [
      'RAKA: "Bawa paketnya ke Gudang 1. Jangan berhenti di tengah jalan."',
      'SARI: "Gudang 1, yang dekat kontainer merah. Cepat, sebelum mandor pulang."',
    ],
    arrive: ['Paket diserahkan. Mandor gudang cuma mengangguk — dia sudah dibayar.'],
    complete: 'JOB 2 SELESAI — gudang beres. +$650',
  },
  {
    id: 3,
    name: 'KABUR KOTA TUA',
    reward: 900,
    dest: { x: -108, z: -120 },
    radius: 8,
    heat: 45,
    objective: 'Kabur ke kota tua, lalu hilang dari kejaran',
    briefing: [
      'RAKA: "Polisi mencium paket itu. Kabur ke kota tua — sekarang!"',
      'SARI: "Gang-gang kota tua sempit. Hilang dari pandangan mereka, baru aman."',
    ],
    arrive: ['Sampai di kota tua. Sekarang sembunyi sampai bintang padam.'],
    complete: 'JOB 3 SELESAI — jejak hilang. +$900',
    hideText: 'Sembunyi di kota tua sampai bintang padam',
  },
  {
    id: 4,
    name: 'FINALE DERMAGA',
    reward: 1500,
    dest: { x: 90, z: 143 },
    radius: 7,
    heat: 25,
    objective: 'Kembali ke Dermaga 2 — kapal sudah menunggu',
    briefing: [
      'RAKA: "Satu urusan terakhir. Balik ke Dermaga 2, kapal sudah menunggu."',
      'SARI: "Ini penutup malam ini. Jangan sampai ketangkap di garis akhir."',
    ],
    arrive: ['Kapal berangkat. Malam ini milik Kru Senja.'],
    complete: 'JOB 4 SELESAI — malam ditutup. +$1500',
  },
];

const DAMAGE_COOLDOWN = 0.7;

export class MissionSystem {
  constructor(scene, police) {
    this.scene = scene;
    this.police = police;
    // Callbacks wired by main.js: onDialogue(text) shows a line on the HUD,
    // onWreck() respawns the player after the car is destroyed, and
    // onComplete(job, cash) fires when a job pays out (main.js saves there).
    this.onDialogue = null;
    this.onWreck = null;
    this.onComplete = null;

    this.cash = 250; // Modal awal Kru Senja.
    this.health = 100;
    this.armour = 100;
    this.started = false;
    this.allDone = false;
    this.jobIndex = 0;
    this.arrived = false;
    this.distance = 0;
    this.time = 0;
    this._damageTimer = 0;
    this._advanceTimer = 0;
    this._pendingAdvance = false;

    // The beacon: a tall amber light pillar plus a flat ring on the ground,
    // both pulsing so the destination reads from across the city.
    const pillarGeo = new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffb52e,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.pillar = new THREE.Mesh(pillarGeo, pillarMat);
    this.pillar.position.y = 35;
    this.pillar.visible = false;
    scene.add(this.pillar);

    const ringGeo = new THREE.RingGeometry(3.2, 4.4, 40);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffb52e,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    this.ring.visible = false;
    scene.add(this.ring);

    this.beaconLight = new THREE.PointLight(0xffb52e, 40, 30, 1.8);
    this.beaconLight.visible = false;
    scene.add(this.beaconLight);
  }

  get job() {
    return JOBS[this.jobIndex] ?? null;
  }

  get target() {
    if (!this.started || this.allDone || !this.job) return null;
    return this.job.dest;
  }

  // The objective line the HUD shows, with a live distance in metres.
  getObjective() {
    if (!this.started) {
      return {
        label: 'KRU SENJA',
        text: 'Tekan Enter — malam dimulai di Dermaga 2.',
        distance: null,
      };
    }
    if (this.allDone) {
      return {
        label: 'KRU SENJA — MALAM SELESAI',
        text: 'Kota ini milikmu. Jelajahi Pelabuhan Senja.',
        distance: null,
      };
    }
    const job = this.job;
    if (this.arrived && job.hideText) {
      return { label: `JOB ${job.id} — ${job.name}`, text: job.hideText, distance: null };
    }
    return {
      label: `JOB ${job.id} — ${job.name}`,
      text: job.objective,
      distance: this.distance,
    };
  }

  say(line) {
    if (this.onDialogue) this.onDialogue(line);
  }

  sayAll(lines) {
    for (const line of lines) this.say(line);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.beginJob();
  }

  beginJob() {
    const job = this.job;
    if (!job) return;
    this.arrived = false;
    this._pendingAdvance = false;
    const { x, z } = job.dest;
    this.pillar.position.set(x, 35, z);
    this.ring.position.set(x, 0.12, z);
    this.beaconLight.position.set(x, 4, z);
    this.pillar.visible = true;
    this.ring.visible = true;
    this.beaconLight.visible = true;
    if (job.heat) this.police.addHeat(job.heat);
    this.sayAll(job.briefing);
  }

  // Hide the beacon and, after a short beat, start the next job (or finish
  // the night when the last one is done).
  completeJob() {
    const job = this.job;
    this.cash += job.reward;
    this.pillar.visible = false;
    this.ring.visible = false;
    this.beaconLight.visible = false;
    this.sayAll(job.arrive);
    this.say(job.complete);
    if (this.onComplete) this.onComplete(job, this.cash);
    this._pendingAdvance = true;
    this._advanceTimer = 2.6;
  }

  // Restore a save record (see save.js): cash, health/armour and which
  // job the night had reached. Called before start(), so beginJob opens
  // the saved job, not job 1.
  restoreSave(data) {
    this.cash = data.cash;
    this.health = data.health;
    this.armour = data.armour;
    this.jobIndex = Math.max(0, Math.min(JOBS.length, data.jobIndex));
    this.allDone = !!data.allDone || this.jobIndex >= JOBS.length;
    this.arrived = false;
    this._pendingAdvance = false;
    return true;
  }

  advance() {
    this._pendingAdvance = false;
    this.jobIndex++;
    if (this.jobIndex >= JOBS.length) {
      this.allDone = true;
      this.say('RAKA: "Empat job, satu malam. Pelabuhan Senja resmi milik kita."');
      return;
    }
    this.beginJob();
  }

  // Fail the current job and restart it from its destination beacon: the
  // crew keeps the job, the player keeps the cash earned so far. A job
  // that is already complete (cash paid, waiting out the beat before the
  // next job starts) cannot fail: a bust or a wreck in that window costs
  // the player the heat reset the bust already applied, not the job.
  failJob(reason) {
    if (this._pendingAdvance) return;
    const job = this.job;
    if (!job || this.allDone) return;
    this._pendingAdvance = false;
    this.arrived = false;
    if (reason === 'busted') {
      this.say('RAKA: "Tertangkap. Panas padam — tapi job masih menunggu. Ulangi."');
    } else if (reason === 'wrecked') {
      this.say('SARI: "Mobil hancur! Kru menarikmu keluar — job diulang dari awal."');
    }
    // Re-show the beacon at the same destination. Clear any heat the failed
    // attempt left behind first, so beginJob's own getaway heat (jobs 3-4)
    // is the only heat the retry starts with.
    this.police.heat = 0;
    this.police.wanted = 0;
    this.beginJob();
  }

  // Called by main.js when the police bust the player.
  onBusted() {
    if (!this.started || this.allDone) return;
    this.failJob('busted');
  }

  // Damage from crashes: armour absorbs first, then health. A wreck fails
  // the current job, restores the car, and asks main.js to respawn.
  damage(amount) {
    if (!this.started || this.allDone) return;
    if (this._damageTimer > 0) return;
    this._damageTimer = DAMAGE_COOLDOWN;
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    if (this.health <= 0) {
      this.health = 100;
      this.armour = 100;
      this.failJob('wrecked');
      if (this.onWreck) this.onWreck();
    }
  }

  update(dt, player) {
    this.time += dt;
    if (this._damageTimer > 0) this._damageTimer -= dt;

    // Beacon pulse: the pillar breathes and the ring slowly grows and fades,
    // so the destination catches the eye even in a shrunken screenshot.
    if (this.pillar.visible) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      this.pillar.material.opacity = 0.22 + 0.3 * pulse;
      const s = 1 + 0.25 * Math.sin(this.time * 2);
      this.ring.scale.set(s, s, 1);
      this.ring.material.opacity = 0.65 + 0.3 * pulse;
      this.beaconLight.intensity = 30 + 25 * pulse;
    }

    if (this._pendingAdvance) {
      this._advanceTimer -= dt;
      if (this._advanceTimer <= 0) this.advance();
      return;
    }
    if (!this.started || this.allDone || !this.job) return;

    const job = this.job;
    const dx = job.dest.x - player.x;
    const dz = job.dest.z - player.z;
    this.distance = Math.hypot(dx, dz);

    if (!this.arrived && this.distance <= job.radius) {
      this.arrived = true;
      this.sayAll(job.arrive);
      // Job 3 is a getaway: arriving is only half of it — the player must
      // also shake the chase (stars back to zero) before it counts.
      if (!job.hideText) this.completeJob();
      return;
    }
    if (this.arrived && job.hideText && this.police.stars === 0) {
      this.completeJob();
    }
  }
}
