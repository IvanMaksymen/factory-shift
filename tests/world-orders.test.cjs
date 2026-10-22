'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/legacy-sim.cjs'),A=require('../src/render.js');
const {harness,settle}=require('./helpers/ui-harness.cjs');
const run=(s,seconds)=>{for(let i=0;i<seconds/F.STEP;i++)s.step(F.STEP);};
function rich(seed=7481){const s=new F.Simulation(F.fresh(seed));s.s.coins=1e9;s.s.stage=39;return s;}

test('Mixed land purchases preserve old coordinates, charge displayed prices and survive reload',()=>{
 const s=rich(),original=JSON.stringify(s.s.tiles);let reload;
 for(const [direction,type,w,h]of [['left','mining',18,10],['down','brownfield',18,14],['left','industrial',22,14],['left','brownfield',26,14],['down','mining',26,18]]){
  const offer=s.landOffer(direction,type),before=s.s.coins;assert.ok(s.expand(direction,type));assert.equal(s.s.coins,before-offer.cost);assert.equal(s.width,w);assert.equal(s.height,h);
  assert.equal(JSON.stringify(s.s.tiles),original);assert.equal(s.docks.size,3);
  const l=s.s.lands.at(-1),def=F.World.TYPES[type];assert.equal(l.blocks.length,def.blocks);assert.ok(F.World.connected(l,l.blocks));
  const spots=Object.keys(s.deposits).filter(k=>F.World.contains(l,...k.split(',').map(Number)));assert.equal(spots.length,F.World.oreCount(l));
  for(const k of spots)assert.ok(!s.blocked.has(k)&&!s.docks.has(k));
  reload=new F.Simulation(F.Simulation.parse(s.serialize()));assert.equal(reload.serialize(),s.serialize());
 }
 s.expand('left','mining');reload.expand('left','mining');assert.equal(reload.serialize(),s.serialize());
 const before=s.serialize();assert.equal(s.expand('up','industrial'),false);assert.equal(s.expand('left','loot'),false);assert.equal(s.serialize(),before);
});

test('Abandoned land remains connected across seeds and both supported directions',()=>{
 for(let seed=1;seed<=70;seed++)for(const dir of ['left','down']){
  const s=rich(seed*971);assert.ok(s.expand(dir,'brownfield'));const l=s.s.lands[0];assert.ok(F.World.connected(l,l.blocks));
  for(const k of l.blocks){assert.ok(s.allowed('belt',...k.split(',').map(Number)));assert.ok(!s.deposits[k]);}
  F.Simulation.parse(s.serialize());
 }
});

test('Legacy left-side dock accepts actual production; negative-coordinate building, refund and survey work',()=>{
 const s=rich();s.expand('left','mining');const l=s.s.lands[0];l.dock=F.World.dock(l,'left');delete s.s.deposits[l.dock];s.world=F.World.compile(s.s.lands);const [dx,dy]=l.dock.split(',').map(Number);
 assert.equal(s.place('smelter',dx+1,dy,2),'');const t=s.s.tiles[F.key(dx+1,dy)];t.input={ore:1};run(s,4);assert.equal(s.s.delivered.iron,1);
 const k=Object.keys(s.deposits).find(k=>k.startsWith('-'));assert.ok(s.isExpansionDeposit(k));const ore=s.deposits[k]==='goldOre'?'silverOre':'goldOre';assert.ok(s.survey(k,ore));
 const [x,y]=k.split(',').map(Number);assert.equal(s.place('drill',x,y),'');assert.ok(s.upgrade(x,y));const before=s.s.coins,paid=s.s.tiles[k].paid;assert.ok(s.remove(x,y));assert.equal(s.s.coins,before+paid);
 assert.ok(s.undo());assert.equal(s.s.tiles[k].level,2);assert.equal(s.s.coins,before);F.Simulation.parse(s.serialize());
});

test('v0.3.3 save migration preserves twelve parcels, credits, live equipment and next RNG sequence',()=>{
 const old=F.fresh(9181);old.contentVersion=3;delete old.lands;delete old.side;old.expansion=12;old.stage=39;old.coins=200000;
 for(let n=0;n<12;n++){old.deposits[`1,${11+n*4}`]='ore';old.deposits[`5,${12+n*4}`]='goldOre';}
 old.tiles['1,55']=F.tile('drill',1,55,0,90);old.tiles['1,55'].level=10;old.tiles['1,55'].job={out:'ore',seconds:2.2};old.tiles['1,55'].progress=.9;
 const original=JSON.stringify(old),s=new F.Simulation(F.Simulation.parse(old));assert.equal(JSON.stringify(old),original);assert.equal(s.height,58);assert.equal(s.width,14);assert.equal(s.s.coins,200000);assert.deepEqual(s.s.tiles,old.tiles);assert.deepEqual(s.deposits,old.deposits);assert.equal(s.s.rng,old.rng);
 assert.ok(s.expand('left','industrial'));assert.equal(s.width,18);assert.equal(s.s.tiles['1,55'].progress,.9);F.Simulation.parse(s.serialize());
});

test('Side orders only count future shipments, persist progress, reward once and keep geology RNG independent',()=>{
 const s=new F.Simulation(F.fresh(142));s.deliver('iron',13,2);const seed=s.s.rng,offers=s.sideOffers();assert.equal(s.s.rng,seed);assert.equal(offers.length,3);
 const o=offers.find(o=>Object.keys(o.need).length===1&&o.need.iron);assert.ok(s.acceptSide(o.id));assert.equal(s.s.side.active.progress.iron,undefined);assert.equal(s.acceptSide(offers[1].id),false);
 for(let i=0;i<5;i++)s.deliver('iron',13,2);const re=new F.Simulation(F.Simulation.parse(s.serialize()));assert.equal(re.s.side.active.progress.iron,5);assert.equal(re.claimSide(),null);
 for(let i=5;i<o.need.iron;i++)re.deliver('iron',13,2);assert.ok(re.sideReady);assert.ok(re.ready);const before=re.s.coins;assert.equal(re.claimSide().reward,o.reward);assert.equal(re.s.coins,before+o.reward);assert.equal(re.claimSide(),null);assert.equal(re.s.side.completed,1);assert.equal(re.s.side.round,1);
 assert.notDeepEqual(re.sideOffers(),offers);assert.equal(re.s.rng,seed);
 const next=re.sideOffers()[0];re.acceptSide(next.id);re.deliver(Object.keys(next.need)[0],13,2);re.abandonSide();assert.ok(re.acceptSide(next.id));assert.deepEqual(re.s.side.active.progress,{});
});

test('Order board uses unlocked recipes across all forty shifts; active contracts survive campaign advances',()=>{
 const products=new Set();
 for(let stage=0;stage<40;stage++){
  const s=rich();s.s.stage=stage;
  for(let n=0;n<8;n++){
   s.s.side.round=n;s.s.side.offers=[];
   const offers=s.sideOffers();for(const o of offers)for(const id of Object.keys(o.need)){products.add(id);assert.ok((F.RECIPES[id].unlock||0)<=stage);assert.ok(Object.values(F.BUILD).some(d=>d.unlock<=stage&&d.recipes.includes(id)));assert.ok(id!=='gear'||stage>=2);}
   F.Simulation.parse(s.serialize());
  }
 }
 assert.equal(products.size,Object.keys(F.RECIPES).length);
 const s=rich();s.s.stage=0;const offers=s.sideOffers();s.acceptSide(offers[0].id);s.s.delivered.iron=8;s.complete();assert.equal(s.s.side.active.id,offers[0].id);assert.deepEqual(s.sideOffers(),offers);s.abandonSide();assert.ok(s.sideOffers().every(o=>o.id.startsWith('1-')));F.Simulation.parse(s.serialize());
});

test('All deliveries retain full price; offline revenue and saved progress cannot double pay',()=>{
 const s=new F.Simulation();s.s.tiles={};s.s.coins=0;
 for(let i=0;i<9;i++)s.deliver('iron',13,2);assert.equal(s.s.coins,36);assert.equal(s.saleValue('copper'),5);
 const o=s.sideOffers().find(o=>o.need.iron&&Object.keys(o.need).length===1);s.acceptSide(o.id);assert.equal(s.saleValue('iron'),4);
 for(let i=0;i<o.need.iron;i++)s.deliver('iron',13,2);assert.equal(s.saleValue('iron'),4);
 const before=s.s.coins;s.deliver('iron',13,2);assert.equal(s.s.coins,Math.round((before+4)*100)/100);assert.equal(s.s.side.active.progress.iron,o.need.iron);
 const a=new F.Simulation();a.place('belt',4,2);a.acceptSide(a.sideOffers()[0].id);const b=new F.Simulation(F.Simulation.parse(a.serialize()));run(a,300);b.offline(300);assert.equal(a.s.coins,b.s.coins);assert.equal(a.s.side.completed,0);assert.equal(b.s.side.completed,0);assert.deepEqual(a.s.side.active.progress,b.s.side.active.progress);
});

test('Production upgrades stay modest at maximum and prices grow without wiping existing balances',()=>{
 const s=rich();s.s.tiles={};s.s.speedLevel=20;s.place('drill',1,2);const t=s.s.tiles['1,2'];t.level=10;s.step(.05);assert.ok(Math.abs(t.progress/.05-1.9)<1e-9);
 s.s.beltLevel=20;assert.ok(Math.abs(s.travel(F.tile('belt',0,0))-.44)<1e-9);
 const belt=F.tile('belt',0,0);belt.level=10;assert.ok(Math.abs(s.travel(belt)-.44/1.9)<1e-9);
 const base=F.tile('drill',0,0);base.level=1;assert.equal(s.upgradeCost(base),63);base.level=9;assert.ok(s.upgradeCost(base)===1615);
 const keep=F.Simulation.parse(s.serialize());assert.equal(keep.coins,s.s.coins);assert.equal(keep.tiles['1,2'].level,10);
});

test('Malformed parcels and side-order progress fail import without modifying the source',()=>{
 const s=rich();s.expand('left','mining');s.acceptSide(s.sideOffers()[0].id);
 for(const mutate of [s=>s.lands[0].x++,s=>s.lands[0].dock='0,0',s=>s.lands[0].blocks=['-4,0'],s=>s.side.active.progress.iron=-1,s=>s.side.active.title='<script>bad</script>',s=>s.deposits['-50,1']='goldOre']){
  const bad=JSON.parse(s.serialize());mutate(bad);const original=JSON.stringify(bad);assert.throws(()=>F.Simulation.parse(bad));assert.equal(JSON.stringify(bad),original);
 }
});

test('Land chooser buys selected direction/type and loads it again; mobile-friendly order flow accepts and claims',async()=>{
 const s=rich();s.s.started=true;const h=harness(s.serialize());await settle();if (!h.el('modalBackdrop').hidden) h.action('start');h.el('expandButton').click();
 h.document.querySelectorAll('[data-direction="left"]')[0].click();h.document.querySelectorAll('[data-type="mining"]')[0].click();assert.match(h.el('modal').textContent,/3 deposits/);h.action('expand');assert.equal(h.el('modalBackdrop').hidden,true);
 h.el('fitButton').click();h.document.querySelectorAll('[data-tool="belt"]')[0].click();
 const scale=Math.min(1000/(18*64+108),650/(10*64+108)),px=(1000-18*64*scale)/2+1.5*64*scale,py=(650-10*64*scale)/2+1.5*64*scale;
 h.pointer('pointerdown',px,py);h.pointer('pointerup',px,py);
 const saved=JSON.parse(h.mem.get('factory-shift-save-v1'));assert.equal(saved.tiles['-3,1'].type,'belt');assert.equal(saved.lands[0].direction,'left');assert.equal(saved.lands[0].type,'mining');assert.match(h.el('floorSize').textContent,/18 × 10/);
 const re=harness(JSON.stringify(saved));await settle();if (!re.el('modalBackdrop').hidden) re.action('start');re.advance(.2);re.el('guideButton').click();re.action('geology');assert.ok(re.el('surveySpot').children.some(el=>el.attrs.value.startsWith('-')));
 const base=F.fresh();base.started=true;base.tiles['4,2']=F.tile('belt',4,2);const ui=harness(JSON.stringify(base));await settle();if (!ui.el('modalBackdrop').hidden) ui.action('start');ui.el('ordersButton').click();assert.equal(ui.document.querySelectorAll('[data-action="acceptSide"]').length,3);ui.action('acceptSide');assert.equal(ui.el('modalBackdrop').hidden,true);ui.advance(70);assert.match(ui.el('ordersButton').textContent,/Claim/);ui.el('ordersButton').click();ui.action('claimSide');assert.equal(JSON.parse(ui.mem.get('factory-shift-save-v1')).side.completed,1);assert.equal(ui.document.querySelectorAll('[data-action="acceptSide"]').length,3);
});

test('Negative world coordinates remain selectable after fit, zoom and focus on desktop and phone sizes',()=>{
 const noop=()=>{},ctx=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)}),r=new A.Renderer({getContext:()=>ctx});
 const s=rich();s.expand('left','industrial');s.expand('left','mining');s.expand('down','brownfield');
 for(const [w,h]of [[1100,720],[390,490],[800,270]]){
  r.resize(w,h);r.syncWorld(s);r.fit();
  for(const mode of ['fit','zoom','focus']){if(mode==='zoom')r.zoomBy(3);if(mode==='focus')r.focusTile(-3,5);r.render(s,1,0);const x=r.ox+(-3+.5)*64*r.scale,y=r.oy+5.5*64*r.scale;assert.deepEqual(r.cellAt(x,y),{x:-3,y:5});}
 }
});
