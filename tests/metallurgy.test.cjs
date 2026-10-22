'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/legacy-sim.cjs'),{harness,settle}=require('./helpers/ui-harness.cjs');
const tick=(s,seconds)=>{for(let i=0;i<seconds/F.STEP;i++)s.step(F.STEP);};
function readySim(seed=42){const s=new F.Simulation(F.fresh(seed));s.s.stage=39;s.s.coins=1e7;s.s.tiles={};return s;}
test('Every campaign product has an acyclic, unlocked path from accessible ores',()=>{
 assert.equal(Object.keys(F.BUILD).length,36);assert.equal(F.CONTRACTS.length,40);assert.equal(Object.keys(F.ORES).length,8);
 for(let stage=0;stage<40;stage++){
  function reachable(id,path=[]){if(F.ORES[id]){assert.ok(['ore','copperOre'].includes(id)||stage>=8);return;}
   assert.ok(!path.includes(id),'Recipe cycle '+id);const r=F.RECIPES[id];assert.ok(r,'Missing recipe '+id);
   const makers=Object.values(F.BUILD).filter(d=>d.recipes.includes(id)&&d.unlock<=stage);assert.ok(makers.length,'Locked machine '+id+' at '+stage);
   assert.ok((r.unlock||0)<=stage);assert.ok(id!=='gear'||stage>=2);
   assert.ok(Object.keys(r.need).length<=3);for(const [k,n]of Object.entries(r.need)){assert.ok(n<=4);reachable(k,[...path,id]);}
  }
  const c=F.contract(stage);assert.ok(c.reward>0);for(const id of Object.keys(c.need))reachable(id);
 }
 assert.equal(F.contract(40).modifier,undefined);assert.ok(F.contract(43).reward>F.contract(40).reward);
});
test('Every recipe consumes exact buffers and ships exactly one correct product',()=>{
 for(const [recipe,r]of Object.entries(F.RECIPES)){
  const [type]=Object.entries(F.BUILD).find(([,d])=>d.recipes.includes(recipe));const s=readySim();assert.equal(s.place(type,12,2),'');
  const t=s.s.tiles['12,2'];if(['press','alloyFurnace'].includes(type)&&t.recipe!==recipe)assert.ok(s.setRecipe(12,2,recipe));
  t.input={...r.need};tick(s,r.seconds+1);assert.equal(s.s.delivered[r.out],1,recipe);assert.ok(Object.values(t.input).every(n=>n===0));tick(s,5);assert.equal(s.s.totalShipped,1,recipe);F.Simulation.parse(s.serialize());
 }
});
test('Every recipe pays more than its consumed ingredients',()=>{
 for(const [id,r]of Object.entries(F.RECIPES)){const cost=Object.entries(r.need).reduce((n,[k,q])=>n+F.ITEMS[k].value*q,0);assert.ok(F.ITEMS[r.out].value>cost,id+' has no processing margin');}
});
test('Industrial land has 2 valid spots; reload preserves ore and future RNG sequence',()=>{
 for(let seed=0;seed<150;seed++){
  const s=readySim(seed);s.expand();const restored=new F.Simulation(F.Simulation.parse(s.serialize()));
  for(let n=1;n<F.MAX_LAND;n++){s.expand();restored.expand();assert.deepEqual(s.deposits,restored.deposits);}
  for(let land=0;land<F.MAX_LAND;land++){const spots=Object.entries(s.deposits).filter(([k])=>{const y=+k.split(',')[1];return y>=10+land*4&&y<14+land*4;});assert.ok(spots.length===2);}
  assert.equal(s.expand(),false);assert.equal(s.height,10+4*F.MAX_LAND);F.Simulation.parse(s.serialize());
 }
});
test('Gold is rare across deterministic exploration samples and every ore appears',()=>{
 const counts=Object.fromEntries(Object.keys(F.ORES).map(k=>[k,0]));let total=0;
 for(let seed=1;seed<=400;seed++){const s=readySim(seed*7919);for(let n=0;n<12;n++)s.expand();for(const [k,id]of Object.entries(s.deposits))if(+k.split(',')[1]>=10){counts[id]++;total++;}}
 assert.ok(counts.goldOre/total>.025 && counts.goldOre/total<.055);assert.ok(counts.silverOre>counts.goldOre);for(const n of Object.values(counts))assert.ok(n>0);
});
test('Surveys guarantee missing resources without changing occupied or starter deposits',()=>{
 const s=readySim();s.expand();const k=Object.keys(s.deposits).find(k=>+k.split(',')[1]>=10);
 const kind=s.deposits[k]==='goldOre'?'nickelOre':'goldOre',before=s.s.coins,cost=s.surveyCost(kind);
 assert.ok(s.survey(k,kind));assert.equal(s.s.coins,before-cost);assert.equal(s.deposits[k],kind);assert.equal(s.survey(k,kind),false);
 const [x,y]=k.split(',').map(Number);s.place('drill',x,y);assert.equal(s.survey(k,'ore'),false);assert.equal(s.survey('1,2','goldOre'),false);s.remove(x,y);s.s.coins=0;assert.equal(s.survey(k,'ore'),false);
});
test('Newly surveyed ore extracts, refines and ships through an actual route',()=>{
 const s=readySim(43);s.expand();const k=Object.keys(s.deposits).filter(k=>+k.split(',')[1]>=10)[1];s.survey(k,'goldOre');const [x,y]=k.split(',').map(Number);
 const dest='13,8',queue=[[[x,y]]],seen=new Set([k]);let path;
 for(let i=0;i<queue.length&&!path;i++){const route=queue[i],[px,py]=route.at(-1);for(const [dx,dy]of F.DIR){const nx=px+dx,ny=py+dy,nk=F.key(nx,ny);if(nk===dest){path=[...route,[nx,ny]];break;}if(s.inside(nx,ny)&&!s.blocked.has(nk)&&!s.docks.has(nk)&&!seen.has(nk)){seen.add(nk);queue.push([...route,[nx,ny]]);}}}
 assert.ok(path.length>=3,'Seed must leave room for refinery');
 path.slice(0,-1).forEach(([px,py],i)=>{const [nx,ny]=path[i+1],dir=F.DIR.findIndex(([dx,dy])=>px+dx===nx&&py+dy===ny);assert.equal(s.place(i===0?'drill':i===1?'goldRefinery':'belt',px,py,dir),'');});
 tick(s,60);assert.ok(s.s.delivered.gold>=8);F.Simulation.parse(s.serialize());
});
test('Ten upgrades improve all equipment, preserve refunds and reject an eleventh upgrade',()=>{
 for(const type of Object.keys(F.BUILD)){
  const s=readySim();const [x,y]=type==='drill'?[1,2]:[0,0];const before=s.s.coins;s.place(type,x,y);
  const t=s.s.tiles[F.key(x,y)],initialTravel=s.travel(t);for(let i=1;i<F.MAX_LEVEL;i++)assert.ok(s.upgrade(x,y),type);assert.equal(t.level,F.MAX_LEVEL);assert.equal(s.upgrade(x,y),false);
  if(F.transport(t))assert.ok(s.travel(t)<initialTravel);F.Simulation.parse(s.serialize());s.remove(x,y);assert.equal(s.s.coins,before);
 }
 const s=readySim();assert.equal(s.research('power'),false);
});
test('Alloy recipe switching completes the current batch and uses the next chosen recipe',()=>{
 const s=readySim();s.place('alloyFurnace',12,2);const t=s.s.tiles['12,2'];t.input={copper:4,tin:1,zinc:1};s.step(.05);assert.equal(t.job.out,'bronze');assert.ok(s.setRecipe(12,2,'brass'));tick(s,10);
 assert.equal(s.s.delivered.bronze,1);assert.equal(s.s.delivered.brass,1);assert.equal(s.s.totalShipped,2);
 s.s.stage=10;assert.equal(s.setRecipe(12,2,'electrum'),false);
});
test('Old v0.2 factories preserve expanded ore, machinery, level and credits',()=>{
 const old=F.fresh();old.expansion=3;old.stage=7;old.coins=1234;delete old.contentVersion;delete old.deposits;delete old.rng;
 old.tiles['1,11']=F.tile('drill',1,11,0,90);old.tiles['1,11'].level=3;
 const parsed=F.Simulation.parse(old);assert.equal(parsed.coins,1234);assert.equal(parsed.deposits['1,11'],'ore');assert.equal(parsed.tiles['1,11'].level,3);assert.equal(parsed.expansion,3);
 const s=new F.Simulation(parsed);s.s.coins=10000;assert.ok(s.expand());assert.equal(s.s.expansion,4);F.Simulation.parse(s.serialize());
});
test('Malformed geology and locked alloy recipes are rejected without mutation',()=>{
 const s=readySim();s.expand();const old=s.serialize();const bad=JSON.parse(old);bad.deposits['0,999']='goldOre';assert.throws(()=>F.Simulation.parse(bad));assert.equal(s.serialize(),old);
 s.place('alloyFurnace',12,2);const raw=JSON.parse(s.serialize());raw.stage=10;raw.tiles['12,2'].recipe='electrum';assert.throws(()=>F.Simulation.parse(raw));
});
test('Guides open from info buttons only; search and 40-shift roadmap work',async()=>{
 const s=F.fresh();s.started=true;s.stage=39;s.coins=9000;const h=harness(JSON.stringify(s));await settle();if (!h.el('modalBackdrop').hidden) h.action('start');
 const card=h.document.querySelectorAll('[data-tool="alloyFurnace"]')[0];h.document.emit('pointerover',{target:card,pointerType:'mouse'});h.document.emit('focusin',{target:card});assert.equal(h.el('modalBackdrop').hidden,true);assert.equal(h.document.getElementById('machineTooltip'),null);
 h.document.querySelectorAll('[data-type="alloyFurnace"]')[0].click();assert.match(h.el('modal').textContent,/10 upgrade levels/);h.el('modalBackdrop').emit('click',{target:h.el('modal')});assert.equal(h.el('modalBackdrop').hidden,false);h.el('modalBackdrop').click();assert.equal(h.el('modalBackdrop').hidden,true);
 h.el('guideButton').click();assert.equal(h.el('guideResults').querySelectorAll('[data-action="recipeChain"]').length,39);
 const input=h.el('guideSearch');input.value='electrum';h.document.emit('input',{target:input});assert.match(h.el('guideResults').textContent,/Electrum/);assert.ok(h.el('guideResults').querySelectorAll('[data-action="recipeChain"]').length<5);
 h.action('recipeChain');assert.match(h.el('modal').textContent,/Extractor/);h.action('guideTab');h.action('campaign');assert.equal(h.el('modal').querySelectorAll('.campaign-list')[0].children.length,40);
});
test('Targeted survey UI charges the displayed price and saves its new ore',async()=>{
 const s=readySim(11);s.s.started=true;s.expand();const k=Object.keys(s.deposits).find(k=>+k.split(',')[1]>=10),kind=s.deposits[k]==='goldOre'?'silverOre':'goldOre';
 const before=s.s.coins,cost=s.surveyCost(kind),h=harness(s.serialize());await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.el('guideButton').click();h.action('geology');h.el('surveySpot').value=k;h.el('surveyOre').value=kind;h.action('survey');
 const saved=JSON.parse(h.mem.get('factory-shift-save-v1'));assert.equal(saved.deposits[k],kind);assert.equal(saved.coins,before-cost);assert.match(h.el('toast').textContent,/Survey complete/);
});
