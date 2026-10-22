const test=require('node:test'),assert=require('node:assert/strict');
const {harness,settle}=require('./helpers/ui-harness.cjs');
const read=h=>JSON.parse(h.mem.get('factory-shift-save-v1'));
test('Startup explains manual save, backup and frequent autosave; periodic saves include production',async()=>{
 const h=harness();await settle();assert.match(h.el('modal').textContent,/Before you close/);assert.match(h.el('modal').textContent,/every 10 seconds/);assert.match(h.el('modal').textContent,/Export save/);
 h.action('start');h.tap(4,2);const before=read(h).savedAt;h.advance(12);assert.ok(read(h).savedAt>before);assert.ok(read(h).time>=9);h.el('settingsButton').click();assert.match(h.el('modal').textContent,/Before closing/);h.action('save');assert.equal(h.el('toast').textContent,'Progress saved.');
});
test('Exit requests confirmation and saves latest production; pagehide also saves without confirmation',async()=>{
 const h=harness();await settle();let prevented=0;const event={preventDefault:()=>prevented++};h.windowEvent('beforeunload',event);assert.equal(prevented,0);
 h.action('start');h.tap(4,2);h.advance(8);h.windowEvent('beforeunload',event);assert.equal(prevented,1);assert.equal(event.returnValue,'');assert.ok(read(h).time>7);const before=read(h).time;
 h.advance(1);h.windowEvent('pagehide');assert.ok(read(h).time>before);assert.equal(prevented,1);
});
test('Blocked storage never reports a successful exit save',async()=>{
 const h=harness(null,'standalone',{writeError:true});await settle();h.action('start');h.advance(1);let prevented=false;h.windowEvent('beforeunload',{preventDefault:()=>prevented=true});assert.ok(prevented);assert.match(h.el('saveStatus').textContent,/Saving blocked/);assert.equal(h.mem.has('factory-shift-save-v1'),false);
});
