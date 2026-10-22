const test=require('node:test'),assert=require('node:assert/strict'),F=require('../src/sim.js');
function sim(){const s=new F.Simulation(F.fresh(741));s.s.coins=1e9;return s;}
test('Mining density scales from 4 per 56 tiles to 16 per 224, and preview matches generated spots',()=>{
 const s=sim();assert.equal(s.landOffer('down','mining').oreCount,4);
 for(let n=0;n<10;n++)s.expand('down');let offer=s.landOffer('left','mining');assert.equal(offer.w*offer.h,200);assert.equal(offer.oreCount,14);s.expand('left','mining');const l=s.s.lands.at(-1);assert.equal(Object.keys(s.deposits).filter(k=>F.World.contains(l,...k.split(',').map(Number))).length,14);
 assert.equal(F.World.oreCount({w:4,h:56},'mining'),16);assert.equal(F.World.oreCount({w:4,h:56},'industrial'),8);
 const re=new F.Simulation(F.Simulation.parse(s.serialize()));assert.deepEqual(re.deposits,s.deposits);s.expand('down','mining');re.expand('down','mining');assert.deepEqual(s.deposits,re.deposits);
});
test('Historical fixed-count parcels retain their deposits while new purchases use density',()=>{
 const s=sim();s.expand('down','mining');const old=JSON.parse(s.serialize());old.contentVersion=6;delete old.lands[0].oreCount;const re=new F.Simulation(F.Simulation.parse(old));assert.deepEqual(re.deposits,old.deposits);for(let n=0;n<9;n++)re.expand('down');assert.equal(re.landOffer('left','mining').oreCount,14);assert.ok(re.expand('left','mining'));F.Simulation.parse(re.serialize());
});
