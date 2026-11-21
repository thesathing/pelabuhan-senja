// PELABUHAN SENJA — save / load (localStorage, one versioned slot).
//
// What is kept: cash, mission progress (which job, whether the night is
// done), the player's health and armour, where the car was left, and the
// mute setting. The game saves when a job is completed and from the pause
// menu; it loads on start, so a night interrupted by a closed tab resumes
// where the crew left off. A corrupt or foreign save is ignored, never
// trusted: load() returns null and the game starts fresh.

const KEY = 'pelabuhan-senja-save-v1';

export class SaveSystem {
  static save(data) {
    try {
      const record = {
        version: 1,
        savedAt: Date.now(),
        cash: Math.round(data.cash ?? 250),
        jobIndex: Math.max(0, Math.min(4, data.jobIndex ?? 0)),
        allDone: !!data.allDone,
        health: Math.max(0, Math.min(100, data.health ?? 100)),
        armour: Math.max(0, Math.min(100, data.armour ?? 100)),
        x: Number(data.x) || 0,
        z: Number(data.z) || 0,
        heading: Number(data.heading) || 0,
        muted: !!data.muted,
      };
      window.localStorage.setItem(KEY, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }

  static load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      if (typeof data.cash !== 'number' || typeof data.jobIndex !== 'number') return null;
      if (!Number.isFinite(data.x) || !Number.isFinite(data.z)) return null;
      if (Math.abs(data.x) > 400 || Math.abs(data.z) > 400) return null;
      return data;
    } catch {
      return null;
    }
  }

  static clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable: nothing to clear, nothing to report.
    }
  }

  static exists() {
    return SaveSystem.load() !== null;
  }
}
