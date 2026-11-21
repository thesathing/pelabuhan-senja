// PELABUHAN SENJA — procedural canvas textures.
//
// Every surface in the city is painted here, on offscreen canvases, so the
// game ships no image files at all: building facades with lit windows, shop
// signs with real lettering, asphalt with lane markings, sand, water, pier
// planks and striped market awnings. All of it is drawn once at boot and
// handed to three.js as CanvasTextures.

import * as THREE from '../vendor/three.module.min.js';

// Tiny deterministic PRNG (mulberry32) so the same seed paints the same walls.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, painter, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// A building facade: plaster in `base`, a grid of windows, most of them
// warm-lit at dusk, a darker ground floor with a shopfront band.
export function facadeTexture(base, floors, seed) {
  const rnd = mulberry32(seed);
  const lit = ['#ffd27a', '#ffb35c', '#ffe9b0', '#ff9d5c'];
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Faint plaster noise.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    const cols = 5;
    const rows = floors;
    const cellW = w / cols;
    const cellH = (h - 34) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW * 0.22;
        const y = r * cellH + cellH * 0.2;
        const ww = cellW * 0.56;
        const wh = cellH * 0.6;
        ctx.fillStyle = '#241a2e';
        ctx.fillRect(x - 2, y - 2, ww + 4, wh + 4);
        ctx.fillStyle = rnd() < 0.62 ? lit[Math.floor(rnd() * lit.length)] : '#2e3444';
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(x, y, ww, 3);
      }
    }
    // Ground floor: darker band with a shopfront.
    ctx.fillStyle = shade(base, -38);
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#1d1420';
    ctx.fillRect(14, h - 28, w - 28, 22);
    ctx.fillStyle = rnd() < 0.7 ? '#ffcf7d' : '#7fb8c9';
    ctx.fillRect(18, h - 25, w - 36, 16);
  });
}

// A shop sign board with painted lettering, sized to wrap a storefront.
export function shopSignTexture(text, bg, fg) {
  return canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = 'bold 52px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 2);
  });
}

// Dark asphalt with a dashed centre line and worn edges. The texture tiles
// along the road, so one strip paints any length of street.
export function asphaltTexture() {
  const rnd = mulberry32(77);
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#26262c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + rnd() * 0.04})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    // Edge lines.
    ctx.fillStyle = '#c9c2a8';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
    // Dashed centre line.
    ctx.fillStyle = '#e8d27a';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y + 8, 4, 34);
  }, 1, 4);
}

// Pale concrete for sidewalks and the city slab.
export function concreteTexture() {
  const rnd = mulberry32(31);
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7d7a72';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
      ctx.fillRect(rnd() * w, rnd() * h, 3, 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }, 12, 12);
}

// Warm beach sand with speckles and soft ripples.
export function sandTexture() {
  const rnd = mulberry32(55);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,80,40,0.12)' : 'rgba(255,240,200,0.14)';
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(150,105,55,0.18)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 20 + i * 28 + rnd() * 8);
      ctx.bezierCurveTo(80, 14 + i * 28, 170, 26 + i * 28, w, 18 + i * 28);
      ctx.stroke();
    }
  }, 10, 6);
}

// Dusk sea: deep violet-blue with a warm sun glitter band and slow swell
// lines. The glitter sits where the low sun hits the water.
export function waterTexture() {
  const rnd = mulberry32(91);
  return canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2c3a6e');
    grad.addColorStop(0.55, '#27355f');
    grad.addColorStop(1, '#1c2547');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,170,90,${0.05 + rnd() * 0.12})`;
      ctx.fillRect(w / 2 - 30 + rnd() * 60, rnd() * h, 14 + rnd() * 26, 2);
    }
    ctx.strokeStyle = 'rgba(160,190,255,0.14)';
    ctx.lineWidth = 2;
    for (let y = 12; y < h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(rnd() * 30, y);
      ctx.bezierCurveTo(80, y - 4, 170, y + 4, w, y);
      ctx.stroke();
    }
  }, 8, 8);
}

// Weathered pier planks, running along the pier's length.
export function pierTexture() {
  const rnd = mulberry32(113);
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6e5136';
    ctx.fillRect(0, 0, w, h);
    const planks = 8;
    for (let p = 0; p < planks; p++) {
      const y = (p * h) / planks;
      ctx.fillStyle = `rgb(${100 + rnd() * 30},${76 + rnd() * 20},${48 + rnd() * 14})`;
      ctx.fillRect(0, y + 1, w, h / planks - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.06})`;
      ctx.fillRect(rnd() * w, rnd() * h, 3, 2);
    }
  }, 1, 8);
}

// Striped canvas awning for the market stalls — alternating warm bands.
export function awningTexture(colorA, colorB) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - 6, w, 6);
  }, 2, 1);
}

// A vertical gradient sky, painted once and wrapped on the sky dome:
// purple overhead, pink mid-band, burning orange at the horizon.
export function skyTexture() {
  return canvasTexture(16, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3d2060');
    grad.addColorStop(0.35, '#7a3570');
    grad.addColorStop(0.62, '#c94f63');
    grad.addColorStop(0.8, '#ff8a4d');
    grad.addColorStop(1, '#ffc46b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}
