const test=require('node:test'),assert=require('node:assert/strict'),F=require('../src/sim.js'),{harness,settle}=require('./helpers/ui-harness.cjs');
test('Legacy global upgrades and large factories cannot change base machine speed',()=>{
 const raw=F.fresh(13);raw.contentVersion=7;raw.powerLevel=20;raw.speedLevel=20;raw.beltLevel=20;raw.coins=200000;
 const s=new F.Simulation(F.Simulation.parse(raw));const t=s.s.tiles['1,2'];assert.equal(s.s.coins,200000);
 for(let y=0;y<10;y++)for(let x=0;x<13;x++)if(!s.s.tiles[F.key(x,y)]&&!s.blocked.has(F.key(x,y)))s.s.tiles[F.key(x,y)]=F.tile('smelter',x,y);
 for(const stage of [0,8,40,42]){s.s.stage=stage;for(let n=0;n<=10;n++){t.level=n+1;t.progress=0;t.out=null;t.job=null;s.step(.05);assert.ok(Math.abs(t.progress/.05-(1+n*.1))<1e-10);}}
 assert.equal(s.speedBonus(F.tile('belt',0,0)),1);assert.equal(s.research('speed'),false);
});
test('Upgrade prices use only a 1.5 geometric factor and actual old investment remains refundable',()=>{
 const s=new F.Simulation();const t=F.tile('drill',1,2);const costs=[];for(let n=1;n<=10;n++){t.level=n;costs.push(s.upgradeCost(t));}assert.deepEqual(costs,[63,95,142,213,319,478,718,1076,1615,2422]);
 for(const type of Object.keys(F.BUILD)){const t=F.tile(type,0,0);let previous=s.upgradeCost(t);for(let n=2;n<=11;n++){t.level=n;const price=s.upgradeCost(t);assert.ok(Math.abs(price-previous*1.5)<=1.25);previous=price;}}
 s.s.tiles['1,2'].paid=12345;const before=s.s.coins;assert.ok(s.remove(1,2));assert.equal(s.s.coins,before+12345);
});
test('Old 160-percent factory now shows zero upgrades and 100 percent, with no Power UI',async()=>{
 const raw=F.fresh();raw.contentVersion=7;raw.started=true;raw.speedLevel=20;raw.beltLevel=20;raw.powerLevel=20;
 const h=harness(JSON.stringify(raw));await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.tap(1,2);assert.equal(h.document.getElementById('powerButton'),null);assert.match(h.el('inspector').textContent,/UPGRADE 0\/10/);assert.match(h.el('inspector').textContent,/100% SPEED/);assert.doesNotMatch(h.el('inspector').textContent,/POWER|160%/);h.action('upgradeMachine');assert.match(h.el('inspector').textContent,/110% SPEED/);
 h.el('upgradesButton').click();assert.equal(h.document.querySelectorAll('[data-action="research"]').length,0);assert.match(h.el('modal').textContent,/Choose your next parcel/);
});
