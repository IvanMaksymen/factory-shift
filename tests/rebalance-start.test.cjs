'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../src/sim.js'),{harness,settle}=require('./helpers/ui-harness.cjs');
const run=(s,t)=>{for(let i=0;i<t/.05;i++)s.step(.05);};
test('Every upgrade adds ten original percentage points; ten upgrades stop at 200 percent',()=>{
 const s=new F.Simulation();s.s.coins=1e8;s.s.tiles={};s.place('drill',1,2);const t=s.s.tiles['1,2'];
 for(let n=0;n<=10;n++){assert.ok(Math.abs(s.productionSpeed(t)-(1+n*.1))<1e-10);t.progress=0;t.job=null;t.out=null;s.step(.05);assert.ok(Math.abs(t.progress/.05-(1+n*.1))<1e-10);if(n<10)assert.ok(s.upgrade(1,2));}
 assert.equal(t.level-1,10);assert.equal(s.upgrade(1,2),false);s.s.speedLevel=20;assert.equal(s.productionSpeed(t),2);
 s.s.stage=8;const press=F.tile('press',0,0);press.level=11;assert.equal(s.productionSpeed(press),2);
 s.s.beltLevel=20;assert.equal(s.speedBonus(F.tile('belt',0,0),true),1);F.Simulation.parse(s.serialize());
});
test('All products keep full prices before, during and after orders',()=>{
 const s=new F.Simulation();s.s.coins=0;s.s.stage=39;
 for(const [kind,item]of Object.entries(F.ITEMS)){assert.equal(s.saleValue(kind),item.value);const before=s.s.coins;s.deliver(kind,13,2);assert.equal(s.s.coins,before+item.value);}
 s.s.stage=0;for(let i=0;i<30;i++)s.deliver('iron',13,2);assert.equal(s.saleValue('iron'),4);const o=s.sideOffers()[0];s.acceptSide(o.id);for(const [k,n]of Object.entries(o.need))for(let i=0;i<n+5;i++)s.deliver(k,13,2);assert.ok(s.sideReady);assert.equal(s.saleValue('iron'),4);
 s.s.stage=41;assert.equal(s.saleValue('wire'),15);
});
test('Random starts vary, preserve starter access, roll rare metals and reload without rerolling',()=>{
 const maps=new Set();let gold=0,silver=0;const types=new Set();
 for(let n=1;n<=500;n++){
  const s=new F.Simulation(F.fresh(n*7919));const entries=Object.entries(s.deposits);assert.equal(entries.length,6);assert.equal(s.deposits['1,2'],'ore');assert.ok(entries.filter(([,v])=>v==='ore').length>=2);assert.ok(entries.filter(([,v])=>v==='copperOre').length>=2);
  for(const [k,ore]of entries){assert.ok(!s.blocked.has(k)&&!s.docks.has(k));assert.ok(k==='1,2'||!s.s.tiles[k]);assert.notEqual(k,'4,2');types.add(ore);gold+=ore==='goldOre';silver+=ore==='silverOre';}
  maps.add(JSON.stringify(s.deposits));const re=new F.Simulation(F.Simulation.parse(s.serialize()));assert.equal(re.serialize(),s.serialize());assert.equal(s.place('belt',4,2),'');run(s,35);assert.ok(s.ready);assert.equal(s.s.coins,232+s.s.totalShipped*4);
  if(n<15){s.s.coins=re.s.coins=10000;s.expand('left','mining');re.expand('left','mining');assert.deepEqual(s.deposits,re.deposits);}
 }
 assert.equal(maps.size,500);assert.equal(types.size,8);assert.ok(gold>20&&gold<60);assert.ok(silver>gold);
});
test('v0.4 saves retain money, old geography and purchased upgrades after migration',()=>{
 const old=F.fresh(12);old.contentVersion=4;delete old.startLayout;old.deposits={'1,2':'ore','1,6':'ore','4,8':'copperOre','9,8':'copperOre'};old.coins=200000;old.tiles['1,2'].level=10;old.tiles['1,2'].paid=12345;
 const source=JSON.stringify(old),s=new F.Simulation(F.Simulation.parse(old));assert.equal(JSON.stringify(old),source);assert.deepEqual(s.deposits,old.deposits);assert.equal(s.s.coins,200000);assert.equal(s.s.tiles['1,2'].level,10);assert.equal(s.s.tiles['1,2'].paid,12345);assert.ok(s.upgrade(1,2));assert.equal(s.productionSpeed(s.s.tiles['1,2']),2);F.Simulation.parse(s.serialize());
});
test('New factory UI rerolls geology and displays base upgrade level zero with full-price descriptions',async()=>{
 const h=harness();await settle();h.action('start');h.sandbox.Math=Object.create(Math);let r=.17;h.sandbox.Math.random=()=>{r+=.21;return r;};
 const reset=()=>{h.el('settingsButton').click();h.action('confirmReset');h.action('reset');return JSON.parse(h.mem.get('factory-shift-save-v1'));};
 const a=reset(),b=reset();assert.notDeepEqual(a.deposits,b.deposits);assert.equal(b.startLayout,'random');
 h.document.querySelectorAll('[data-tool="select"]')[0].click();h.tap(1,2);assert.match(h.el('inspector').textContent,/UPGRADE 0\/10/);assert.match(h.el('inspector').textContent,/100% SPEED/);h.action('upgradeMachine');assert.match(h.el('inspector').textContent,/UPGRADE 1\/10/);assert.match(h.el('inspector').textContent,/110% SPEED/);
 h.el('ordersButton').click();assert.match(h.el('modal').textContent,/Every shipment earns full price/);assert.doesNotMatch(h.el('modal').textContent,/Surplus earns 20%/);
});
