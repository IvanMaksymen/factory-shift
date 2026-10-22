/* Optional CrazyGames SDK v3 bridge. The standalone build makes no requests. */
(function (root) {
  'use strict';
  const KEY = 'factory-shift-save-v1';
  class Platform {
    constructor() { this.sdk = null; this.storage = null; this.active = false; this.memory = new Map(); this.storageAvailable = true; }
    async init() {
      if (root.FACTORY_PLATFORM === 'crazygames') {
        const sdk = root.CrazyGames?.SDK;
        if (!sdk) throw new Error('The CrazyGames SDK could not load. Check your connection and reload.');
        let timer;
        try { await Promise.race([sdk.init(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Platform connection timed out. Please reload to protect your saved progress.')), 12000); })]); }
        finally { clearTimeout(timer); }
        if (sdk.environment === 'crazygames' || sdk.environment === 'local') { this.sdk = sdk; this.storage = sdk.data; this.event('loadingStart'); return; }
      }
      try { this.storage = root.localStorage; } catch (_) { this.storageAvailable = false; }
    }
    event(name) { try { const result = this.sdk?.game?.[name]?.(); if (result?.catch) result.catch(() => {}); } catch (_) { /* Local gameplay does not depend on telemetry. */ } }
    setPlaying(on) { if (on === this.active) return; this.active = on; this.event(on ? 'gameplayStart' : 'gameplayStop'); }
    load() {
      if (!this.storage) {
        if (this.sdk) throw new Error('Saved progress is unavailable. Reload to try again; your factory will not be overwritten.');
        return null;
      }
      try { return this.storage.getItem(KEY); }
      catch (_) {
        this.storageAvailable = false; this.storage = null;
        if (this.sdk) throw new Error('Could not read your saved factory. Reload to try again; no new save has been written.');
        return null;
      }
    }
    save(raw) { this.memory.set(KEY, raw); if (!this.storage) { this.storageAvailable = false; return false; } try { this.storage.setItem(KEY, raw); this.storageAvailable = true; return true; } catch (_) { this.storageAvailable = false; return false; } }
  }
  root.FactoryPlatform = Platform;
})(typeof globalThis !== 'undefined' ? globalThis : this);
