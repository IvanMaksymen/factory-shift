const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./helpers/legacy-sim.cjs');
const { harness, settle } = require('./helpers/ui-harness.cjs');
function run(s, seconds) { for(let i=0;i<seconds/F.STEP;i++) s.step(F.STEP); }
test('Expansion charges once, preserves existing lines and unlocks exactly four rows',()=>{
 const s=new F.Simulation(); assert.ok(s.allowed('belt',0,10)); assert.equal(s.expand(),false);
 const line=JSON.stringify(s.s.tiles); s.s.coins=5108;
 for(const [cost,h] of [[500,14],[1400,18],[3200,22]]) {const before=s.s.coins;assert.equal(s.expand(),true);assert.equal(s.s.coins,before-cost);assert.equal(s.height,h);assert.equal(s.allowed('belt',0,h-1),'');assert.ok(s.allowed('belt',0,h));}
 assert.equal(s.expand(),false);assert.equal(s.s.coins,8);assert.equal(JSON.stringify(s.s.tiles),line);
 assert.equal(F.Simulation.parse(s.serialize()).expansion,3);
});
test('Legacy expanded deposits retain working production after migration',()=>{
 const old=F.fresh();delete old.contentVersion;delete old.deposits;delete old.rng;old.expansion=1;old.coins=2000;
 const s=new F.Simulation(F.Simulation.parse(old));
 assert.equal(s.place('drill',1,11),'');assert.equal(s.place('smelter',2,11),'');
 for(let x=3;x<13;x++)assert.equal(s.place('belt',x,11),'');
 run(s,40);assert.ok(s.s.delivered.iron>=8);assert.equal(F.Simulation.parse(s.serialize()).tiles['1,11'].type,'drill');
});
test('All four new recipes consume exact inputs, block wrong inputs and ship valuable goods',()=>{
 for(const [type,kind] of Object.entries({cutter:'rod',polisher:'casing',electronics:'circuit',fabricator:'robot'})){
  const s=new F.Simulation();s.s.stage=7;s.s.coins=3000;s.s.tiles={};s.place(type,12,2);const t=s.s.tiles['12,2'];const r=F.RECIPES[kind];
  assert.equal(s.accepts(t,'ore',0),false);t.input={...r.need};run(s,10);
  assert.equal(s.s.delivered[kind],1);assert.equal(s.s.totalEarned,F.ITEMS[kind].value);assert.ok(Object.values(t.input).every(n=>n===0));assert.ok(!t.job);F.Simulation.parse(s.serialize());
 }
});
test('Express belts move in half the time, preserve direction rules and serialize',()=>{
 for(const type of ['belt','fastbelt']){const s=new F.Simulation();s.s.stage=2;s.s.tiles={};s.place(type,12,2);s.s.tiles['12,2'].out={kind:'iron',from:0,age:0};run(s,.25);assert.equal(s.s.totalShipped,type==='fastbelt'?1:0);F.Simulation.parse(s.serialize());}
});
test('Old saves migrate without losing money; impossible land data is rejected',()=>{
 const s=F.fresh();delete s.expansion;const migrated=F.Simulation.parse(s);assert.equal(migrated.expansion,0);assert.equal(migrated.coins,240);
 for(const expansion of [-1,F.MAX_LAND+1,1.5,'2'])assert.throws(()=>F.Simulation.parse({...s,expansion}));
 s.tiles['0,10']=F.tile('belt',0,10);assert.throws(()=>F.Simulation.parse(s));
});
test('UI categories, expansion purchase and restored expanded saves remain usable',async()=>{
 const s=F.fresh();s.coins=1000;s.started=true;s.stage=7;
 const h=harness(JSON.stringify(s));await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.el('expandButton').click();h.action('expand');
 assert.equal(h.el('modalBackdrop').hidden,true);assert.match(h.el('floorSize').textContent,/14 × 14/);
 const tab=h.document.querySelectorAll('[data-category="advanced"]')[0];tab.click();assert.equal(h.el('buildCards').querySelectorAll('[data-tool]').length,Object.values(F.BUILD).filter(d=>d.group==='advanced').length);
 const saved=h.mem.get('factory-shift-save-v1');assert.equal(JSON.parse(saved).expansion,1);
 const re=harness(saved);await settle();if (!re.el('modalBackdrop').hidden) re.action('start');re.advance(.3);assert.match(re.el('floorSize').textContent,/14 × 14/);
});
test('Robot lab merges three real conveyor feeds and ships one robot',()=>{
 const s=new F.Simulation();s.s.stage=7;s.s.coins=3000;s.s.tiles={};s.place('fabricator',12,6);
 for(const [x,y,dir,kind] of [[11,6,0,'motor'],[12,5,1,'circuit'],[12,7,3,'casing']]){s.place('belt',x,y,dir);s.s.tiles[F.key(x,y)].out={kind,age:0,from:dir};}
 run(s,10);assert.equal(s.s.delivered.robot,1);assert.equal(s.s.totalEarned,155);assert.equal(s.s.tiles['12,6'].input.motor,0);
});
