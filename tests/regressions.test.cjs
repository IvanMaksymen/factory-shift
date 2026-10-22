const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('./helpers/legacy-sim.cjs');
const { harness, settle } = require('./helpers/ui-harness.cjs');
const run = (s, seconds) => { for(let i=0;i<Math.round(seconds/.05);i++)s.step(.05); };

test('Offline and foreground simulation produce the same deliveries over 5 minutes', () => {
  const a=new F.Simulation();a.place('belt',4,2);run(a,7);
  const b=new F.Simulation(F.Simulation.parse(a.serialize()));
  run(a,300);b.offline(300);
  assert.equal(b.s.totalShipped,a.s.totalShipped);
  assert.equal(b.s.coins,a.s.coins);
  assert.ok(Math.abs(b.s.elapsed-a.s.elapsed)<.051);
});

test('Starter equipment remains recoverable after upgrading and recycling it', () => {
  const s=new F.Simulation();assert.ok(s.upgrade(1,2));
  for(const t of Object.values(s.s.tiles))s.remove(t.x,t.y);
  assert.equal(s.s.coins,240);
  assert.equal(s.place('drill',1,2),'');assert.equal(s.place('smelter',3,2),'');
  for(let x=2;x<=12;x++)if(x!==3)assert.equal(s.place('belt',x,2),'');
  run(s,70);assert.ok(s.ready);assert.ok(s.s.coins>0);
});

test('A rejected placement does not add an Undo operation or clear existing production', async () => {
  const h=harness();await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(4,2);h.advance(10);
  h.tap(3,2); // Belt tool cannot replace a smelter.
  h.el('undoButton').click();h.el('settingsButton').click();h.action('save');
  const state=JSON.parse(h.mem.get('factory-shift-save-v1'));
  assert.equal(state.tiles['4,2'],undefined,'Undo must remove the last successful edit, not a failed attempt');
});

test('Inspector enables an upgrade as soon as its exact price is affordable', async () => {
  const s=F.fresh();s.stage=1;s.started=true;s.coins=69;s.tiles['6,2']=F.tile('press',6,2,0,100);
  // One item reaches a dock while the inspector is open, taking credits 69 → 77.
  s.tiles['12,2'].out={kind:'plate',age:0,from:0};
  const h=harness(JSON.stringify(s));await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(6,2);
  assert.equal(h.document.querySelectorAll('[data-action="upgradeMachine"]')[0].disabled,true);
  h.advance(1);
  assert.equal(h.document.querySelectorAll('[data-action="upgradeMachine"]')[0].disabled,false);
});

test('A failed cloud save read must not offer a fresh game that can overwrite progress', async () => {
  const old=JSON.stringify(F.fresh());const h=harness(old,'crazygames',{readError:true});await settle();
  assert.equal(h.document.querySelectorAll('[data-action="start"]').length,0);
  assert.ok(h.el('modalTitle').textContent.includes('safe'));
  assert.equal(h.mem.get('factory-shift-save-v1'),old);
});

test('Starter storage, purchases and Undo cannot mint money or duplicate free machines', () => {
  const s=new F.Simulation();s.s.stage=7;
  let seed=734531;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let i=0;i<8000;i++) {
    const x=rnd(14),y=rnd(10),type=Object.keys(F.BUILD)[rnd(7)];
    switch(rnd(6)){case 0:s.place(type,x,y,rnd(4));break;case 1:s.remove(x,y);break;case 2:s.rotate(x,y);break;case 3:s.upgrade(x,y);break;case 4:s.undo();break;case 5:s.research(['power','speed','belt'][rnd(3)]);break;}
    const investment=Object.values(s.s.tiles).reduce((n,t)=>n+t.paid,0);
    const research=['power','speed','belt'].reduce((n,type)=>{const l=s.s[type+'Level'];return n+({power:150,speed:220,belt:100}[type])*l*(l+1)/2;},0);
    assert.equal(s.s.coins+investment+research,240);
    for(const [type,total]of Object.entries({belt:9,drill:1,smelter:1}))assert.equal(Object.values(s.s.tiles).filter(t=>t.type===type&&t.freeBase).length+(s.s.spares[type]||0),total);
  }
  assert.doesNotThrow(()=>F.Simulation.parse(s.serialize()));
});

test('v0.1 saves recover discarded starter machines without resetting progress', () => {
  const s=F.fresh();delete s.spares;s.stage=2;s.coins=357;s.totalShipped=44;
  delete s.tiles['1,2'];delete s.tiles['5,2'];
  for(const t of Object.values(s.tiles))delete t.freeBase;
  s.tiles['3,2'].level=3;s.tiles['3,2'].paid=231; // upgrades on the free starter smelter
  const upgraded=F.Simulation.parse(s);
  assert.equal(upgraded.stage,2);assert.equal(upgraded.totalShipped,44);assert.equal(upgraded.coins,357);
  assert.equal(upgraded.spares.drill,1);assert.equal(upgraded.spares.belt,1);assert.equal(upgraded.spares.smelter,0);
  assert.equal(upgraded.tiles['3,2'].freeBase,true);
});

test('Frame rate does not materially change production at 30, 60 and 144 Hz', async () => {
  const results=[];
  for(const fps of [30,60,144]) {const h=harness();await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(4,2);h.advance(60,fps);h.el('settingsButton').click();h.action('save');results.push(JSON.parse(h.mem.get('factory-shift-save-v1')).totalShipped);}
  assert.ok(Math.max(...results)-Math.min(...results)<=1,results.join(','));
});

test('Returning from a background tab earns once, with no earnings during manual pause', async () => {
  const h=harness();await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(4,2);h.advance(6);
  h.background(120);h.el('pauseButton').click();
  const before=JSON.parse(h.mem.get('factory-shift-save-v1'));assert.ok(before.totalShipped>30);
  h.background(120);h.el('settingsButton').click();h.action('save');
  const after=JSON.parse(h.mem.get('factory-shift-save-v1'));assert.equal(after.totalShipped,before.totalShipped);assert.equal(after.coins,before.coins);
});

test('Denied local storage remains playable and reports that saving is unavailable', async () => {
  const h=harness(null,'standalone',{writeError:true});await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(4,2);h.advance(35);
  assert.equal(h.el('shipButton').disabled,false);assert.ok(h.el('saveStatus').textContent.includes('blocked'));
});
