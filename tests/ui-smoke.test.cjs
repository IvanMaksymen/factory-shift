/* UI integration harness. These are DOM-stub tests, not browser/layout tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, settle } = require('./helpers/ui-harness.cjs');

test('UI starts, pointer placement ships a contract, claim unlocks the Press, and menus work', async () => {
  const h = harness(); await settle(); assert.equal(h.el('modalTitle').textContent.includes('A small floor.'), true);
  h.action('start'); assert.equal(h.el('modalBackdrop').hidden, true);
  h.tap(4,2); h.advance(31); assert.equal(h.el('shipButton').disabled, false); h.el('shipButton').click();
  assert.ok(h.el('modalTitle').textContent.includes('shift well spent')); h.action('nextShift'); assert.equal(h.el('shiftLabel').textContent, 'SHIFT 02');
  h.tap(6,2); h.advance(40); assert.equal(h.el('shipButton').disabled, false);
  h.el('helpButton').click(); assert.equal(h.el('modalTitle').textContent, 'Make yourself at home.'); h.action('closeModal');
  h.el('settingsButton').click(); h.action('sound'); assert.equal(h.el('modalTitle').textContent, 'Make it your shift.'); h.action('save'); h.action('closeModal');
  const s = JSON.parse(h.mem.get('factory-shift-save-v1')); assert.equal(s.stage,1); assert.equal(s.tiles['6,2'].type,'press'); assert.equal(s.sound,false);
});
test('Drag draws a turning route; pinch gestures place no accidental belts', async () => {
  const h = harness(); await settle(); h.action('start');
  const a=h.tilePoint(0,0),b=h.tilePoint(3,0),c=h.tilePoint(3,1);
  h.pointer('pointerdown',a.x,a.y);h.pointer('pointermove',b.x,b.y);h.pointer('pointermove',c.x,c.y);h.pointer('pointerup',c.x,c.y);
  let s=JSON.parse(h.mem.get('factory-shift-save-v1')); assert.equal(s.tiles['3,0'].dir,1); assert.equal(s.tiles['3,1'].dir,1); assert.equal(s.tiles['0,0'].dir,0);
  const before=Object.keys(s.tiles).length;
  h.pointer('pointerdown',a.x,a.y,11);h.pointer('pointerdown',b.x,b.y,12);h.pointer('pointermove',b.x+30,b.y,12);h.pointer('pointerup',b.x+30,b.y,12);h.pointer('pointerup',a.x,a.y,11);
  h.el('settingsButton').click();h.action('save');s=JSON.parse(h.mem.get('factory-shift-save-v1'));assert.equal(Object.keys(s.tiles).length,before);
});
test('Pause freezes production and resuming continues; a local save reloads', async () => {
  const h=harness();await settle();h.action('start');h.tap(4,2);h.advance(8);h.el('pauseButton').click();
  const before=h.el('clock').textContent;h.advance(20);assert.equal(h.el('clock').textContent,before);h.el('resumeButton').click();h.advance(8);assert.notEqual(h.el('clock').textContent,before);
  const raw=h.mem.get('factory-shift-save-v1');const reload=harness(raw);await settle();assert.equal(reload.el('modalBackdrop').hidden,true);const restored=JSON.parse(reload.mem.get('factory-shift-save-v1'));assert.equal(restored.stage,JSON.parse(raw).stage);reload.advance(12);assert.ok(JSON.parse(reload.mem.get('factory-shift-save-v1')).time>restored.time);
});
test('SDK v3 bridge initializes before Data, uses start/stop for gameplay, and sends no ads', async () => {
  const h=harness(null,'crazygames');await settle();assert.equal(h.calls[0],'init');assert.ok(h.calls.includes('loadingStop'));assert.ok(!h.calls.includes('gameplayStart'));
  h.action('start');assert.ok(h.calls.includes('gameplayStart'));h.el('settingsButton').click();assert.equal(h.calls.at(-1),'gameplayStop');h.action('closeModal');assert.equal(h.calls.at(-1),'gameplayStart');
  assert.ok(h.mem.has('factory-shift-save-v1'));assert.equal(h.calls.some(c=>/ad/i.test(c)&&!c.startsWith('loading')),false);
});
