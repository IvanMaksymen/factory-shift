const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../src/sim.js'),{harness,settle}=require('./helpers/ui-harness.cjs');
test('Right purchases are rejected without spending or changing RNG; new land never adds docks',()=>{
 const s=new F.Simulation(F.fresh(192));s.s.coins=1e9;const before=s.serialize();assert.equal(s.landOffer('right'),null);assert.equal(s.expand('right'),false);assert.equal(s.serialize(),before);
 for(let i=0;i<12;i++){assert.ok(s.expand(i%2?'down':'left',['industrial','mining','brownfield'][i%3]));assert.equal(s.s.lands.at(-1).dock,null);assert.deepEqual([...s.docks],['13,2','13,6','13,8']);assert.equal(s.world.maxX,14);const re=new F.Simulation(F.Simulation.parse(s.serialize()));assert.deepEqual([...re.docks],[...s.docks]);}
});
test('Land chooser offers only left and down and promises no new docks',async()=>{
 const h=harness();await settle();h.action('start');h.el('expandButton').click();assert.equal(h.document.querySelectorAll('[data-direction="right"]').length,0);assert.equal(h.document.querySelectorAll('[data-action="landDirection"]').length,2);assert.match(h.el('modal').textContent,/no shipping docks/);assert.doesNotMatch(h.el('modal').textContent,/1 dock/);
});
