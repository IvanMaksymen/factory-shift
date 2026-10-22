const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '../../src', file), 'utf8');

function harness(saved = null, platformMode = 'standalone', options = {}) {
  let document, frame, now = 0;
  const noop = () => {};
  const context2d = new Proxy({ createRadialGradient: () => ({ addColorStop: noop }) }, { get: (o, p) => p in o ? o[p] : noop, set: (o, p, v) => (o[p] = v, true) });
  const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  class Element {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.id = attrs.id; this.dataset = {}; this.children = []; this.parentElement = null; this.style = {}; this.listeners = {}; this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs; this._text = ''; this.className = attrs.class || '';
      for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, a) => a.toUpperCase())] = decode(v);
      this.classList = { contains: n => this.className.split(' ').includes(n), add: n => { if (!this.classList.contains(n)) this.className += ' ' + n; }, remove: n => { this.className = this.className.split(' ').filter(x => x !== n).join(' '); }, toggle: (n, value) => { const v = value === undefined ? !this.classList.contains(n) : value; v ? this.classList.add(n) : this.classList.remove(n); } };
    }
    set innerHTML(value) { this.children = []; this._text = ''; parse(value, this); }
    get innerHTML() { return ''; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
    appendChild(node) { this.children.push(node); node.parentElement = this; return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    matches(selector) {
      selector = selector.trim();
      if (selector.includes(':not(')) { const [base, rest] = selector.split(':not('); return this.matches(base) && !this.matches(rest.slice(0, -1)); }
      if (selector === ':disabled') return this.disabled;
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      const a = selector.match(/^([\w-]*)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (a) return (!a[1] || this.tagName === a[1].toUpperCase()) && a[2] in this.attrs && (a[3] === undefined || this.attrs[a[2]] === a[3]);
      return this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector) { const selectors = selector.split(','); const all = []; const walk = n => { for (const ch of n.children) { if (selectors.some(s => ch.matches(s))) all.push(ch); walk(ch); } }; walk(this); return all; }
    closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentElement; } return null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type, data = {}) { const e = { target: this, preventDefault: noop, ...data }; for (const fn of this.listeners[type] || []) fn(e); this['on' + type]?.(e); return e; }
    click() { if (this.disabled) return; this.focus(); const e = this.emit('click'); if (this !== document) document.emit('click', e); }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 650 }; }
    getContext() { return context2d; }
    setPointerCapture() {} releasePointerCapture() {}
  }
  function parse(html, root) {
    const stack = [root]; const re = /<!--[\s\S]*?-->|<\/?[\w-]+[^>]*>|[^<]+/g; let m;
    while ((m = re.exec(html))) {
      const tok = m[0]; if (tok.startsWith('<!--')) continue;
      if (tok.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (tok.startsWith('<')) {
        const tag = tok.match(/^<([\w-]+)/)[1]; const attrs = {}; const ar = /([\w-]+)(?:="([^"]*)"|='([^']*)')?/g; ar.lastIndex = tag.length + 1; let a;
        while ((a = ar.exec(tok))) attrs[a[1]] = a[2] ?? a[3] ?? '';
        const node = new Element(tag, attrs); stack[stack.length - 1].appendChild(node);
        if (!['input', 'meta', 'link', 'br', 'img', 'hr'].includes(tag) && !tok.endsWith('/>')) stack.push(node);
      } else stack[stack.length - 1]._text += decode(tok);
    }
  }
  document = new Element('document'); parse(source('index.html'), document); document.getElementById = id => {
    let found; const walk = n => { if (n.id === id) found = n; for (const ch of n.children) walk(ch); }; walk(document); return found || null;
  };
  document.createElement = tag => new Element(tag); document.body = document.querySelectorAll('body')[0]; document.hidden = false; document.activeElement = document.body;
  const mem = new Map(saved ? [['factory-shift-save-v1', saved]] : []), storage = { getItem: k => { if(options.readError) throw new Error('Save service unavailable'); return mem.get(k) || null; }, setItem: (k, v) => { if(options.writeError) throw new Error('Storage unavailable'); mem.set(k, v); } };
  const calls = [], sdk = { init: async () => calls.push('init'), environment: 'local', data: storage, game: new Proxy({}, { get: (_, name) => () => { calls.push(name); return Promise.resolve(); } }) };
  class ClockDate extends Date { static now() { return 1792330000000+now; } }
  const windowListeners={};
  const sandbox = { console, document, localStorage: storage, performance: { now: () => now }, devicePixelRatio: 1, setTimeout: () => 1, clearTimeout: noop, requestAnimationFrame: fn => { frame = fn; }, ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() { this.fn(); } }, Date:ClockDate, Map, Set, Math, Promise, JSON, Blob, URL, addEventListener: (event,fn)=>{(windowListeners[event]||=[]).push(fn);}, FACTORY_PLATFORM: platformMode, CrazyGames: { SDK: sdk } };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['world.js', 'content.js','sim.js','render.js','platform.js','app.js'].forEach(file => vm.runInContext(source(file), sandbox, { filename: file }));
  const el = id => { const found = document.getElementById(id); assert.ok(found, `Missing element #${id}`); return found; };
  const action = name => { const found = document.querySelectorAll(`[data-action="${name}"]`)[0]; assert.ok(found, `Missing action ${name}`); found.click(); };
  function advance(seconds, fps=20) { for (let i = 0; i < Math.round(seconds * fps); i++) { now += 1000/fps; frame?.(now); } }
  function background(seconds) { document.hidden=true;document.emit('visibilitychange');now+=seconds*1000;document.hidden=false;document.emit('visibilitychange'); }
  function pointer(type, x, y, id = 1) { return el('factoryCanvas').emit(type, { pointerId: id, clientX: x, clientY: y, button: 0 }); }
  function tilePoint(x, y) { const scale = Math.min(1000 / (14 * 64 + 108), 650 / (10 * 64 + 108)); return { x: (1000 - 14 * 64 * scale) / 2 + (x + .5) * 64 * scale, y: (650 - 10 * 64 * scale) / 2 + (y + .5) * 64 * scale }; }
  function tap(x, y) { const p = tilePoint(x, y); pointer('pointerdown',p.x,p.y);pointer('pointerup',p.x,p.y); }
  return { el, action, advance, background, tap, pointer, tilePoint, document, calls, mem, sandbox, windowEvent:(type,event={})=>{for(const fn of windowListeners[type]||[])fn(event);} };
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

module.exports = { harness, settle };
