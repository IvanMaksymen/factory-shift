const test=require('node:test'),assert=require('node:assert/strict'),F=require('../src/sim.js');
const {harness,settle}=require('./helpers/ui-harness.cjs');
const cells=[{x:0,y:0},{x:1,y:0}];
function setup(){const s=new F.Simulation();s.s.coins=10000;s.place('belt',0,0);s.place('smelter',1,0);s.history=[];return s;}
test('Group move supports overlap with its own old cells and preserves investment, recipes and inventory',()=>{
 const s=setup(),a=s.s.tiles['0,0'],b=s.s.tiles['1,0'];a.out={kind:'ore',age:.1,from:0};b.input={ore:2};b.level=3;b.paid+=200;const coins=s.s.coins;
 assert.equal(s.move(cells,1,0),'');assert.equal(s.s.tiles['1,0'],a);assert.equal(s.s.tiles['2,0'],b);assert.equal(s.s.tiles['0,0'],undefined);assert.equal(b.x,2);assert.equal(b.input.ore,2);assert.equal(b.level,3);assert.equal(s.s.coins,coins);assert.equal(s.history.length,1);
 const restored=new F.Simulation(F.Simulation.parse(s.serialize()));assert.equal(restored.s.tiles['2,0'].level,3);assert.equal(restored.s.tiles['2,0'].paid,b.paid);
 assert.ok(s.undo());assert.equal(s.s.tiles['0,0'].type,'belt');assert.equal(s.s.tiles['1,0'].type,'smelter');assert.equal(s.s.coins,coins);assert.equal(s.s.tiles['0,0'].out,null);
});
test('Invalid moves are atomic: bounds, occupied equipment, utility structures, docks and extractor deposits',()=>{
 const s=setup();const before=JSON.stringify(s.s.tiles);
 for(const [dx,dy] of [[-1,0],[0,2],[6,4],[12,2],[0,.5]]){assert.ok(s.move(cells,dx,dy));assert.equal(JSON.stringify(s.s.tiles),before);assert.equal(s.history.length,0);}
 const empty=Array.from({length:14},(_,x)=>({x,y:1})).find(p=>!s.deposits[F.key(p.x,p.y)]&&!s.s.tiles[F.key(p.x,p.y)]);assert.match(s.move([{x:1,y:2}],empty.x-1,-1),/Extractors/);assert.equal(s.move(cells,0,0),'');assert.equal(s.history.length,0);
 const ore=Object.entries(s.deposits).find(([k])=>k!=='1,2'&&!s.s.tiles[k]);const [x,y]=ore[0].split(',').map(Number);assert.equal(s.move([{x:1,y:2}],x-1,y-2),'');assert.equal(s.s.tiles[ore[0]].type,'drill');
});
test('Group upgrades quote unique eligible machines, fail as a whole and stop at 200 percent',()=>{
 const s=setup(),dup=[...cells,cells[0]],quote=s.upgradeQuote(dup);assert.equal(quote.count,2);assert.equal(quote.cost,83);
 s.s.coins=quote.cost-1;assert.equal(s.upgradeMany(dup),false);assert.equal(s.s.tiles['0,0'].level,1);assert.equal(s.history.length,0);
 s.s.coins=100000;for(let i=0;i<10;i++)assert.ok(s.upgradeMany(dup));assert.equal(s.s.tiles['0,0'].level,11);assert.equal(s.speedBonus(s.s.tiles['1,0']),2);assert.deepEqual(s.upgradeQuote(cells),{count:0,cost:0});assert.equal(s.upgradeMany(cells),false);
 s.s.tiles['1,0'].level=10;assert.equal(s.upgradeQuote(cells).count,1);
});
test('Group recycle refunds actual investment exactly once; starter machines return to storage; one undo',()=>{
 const s=setup();s.upgrade(1,2);const targets=[...cells,{x:1,y:2},cells[0]],before=s.s.coins,refund=s.selection(targets).reduce((n,t)=>n+t.paid,0),depth=s.history.length;
 assert.ok(s.removeMany(targets));assert.equal(s.s.coins,before+refund);assert.equal(s.s.spares.drill,1);assert.equal(s.history.length,depth+1);assert.equal(s.removeMany(targets),false);assert.equal(s.s.coins,before+refund);assert.ok(s.undo());assert.equal(s.s.coins,before);assert.equal(s.s.tiles['1,2'].level,2);
});
async function ui(){const s=setup();s.s.started=true;s.s.tutorial=false;const h=harness(s.serialize());await settle();h.el('selectTool').click();return h;}
function event(h,type,x,y,extra={}){const p=h.tilePoint(x,y);h.el('factoryCanvas').emit(type,{pointerId:1,button:0,clientX:p.x,clientY:p.y,...extra});}
function click(h,x,y,extra={}){event(h,'pointerdown',x,y,extra);event(h,'pointerup',x,y,extra);}
function state(h){return JSON.parse(h.mem.get('factory-shift-save-v1'));}
test('Shift-click group, right-click menu, aggregate upgrade, confirmation cancel/confirm and undo',async()=>{
 const h=await ui();click(h,0,0);click(h,1,0,{shiftKey:true});assert.match(h.el('inspector').textContent,/2 objects selected/);assert.match(h.el('inspector').textContent,/83 C/);
 event(h,'pointerdown',0,0,{button:2});assert.equal(h.el('selectionMenu').hidden,false);assert.match(h.el('selectionMenu').textContent,/2 selected/);
 h.el('selectionMenu').querySelectorAll('[data-action="upgradeMachine"]')[0].click();assert.equal(state(h).tiles['0,0'].level,2);assert.equal(state(h).tiles['1,0'].level,2);
 h.action('recycleMachine');assert.match(h.el('modalTitle').textContent,/2 objects/);h.action('closeModal');assert.ok(state(h).tiles['0,0']);
 h.action('recycleMachine');h.action('confirmRecycle');assert.equal(state(h).tiles['0,0'],undefined);assert.equal(state(h).tiles['1,0'],undefined);
 h.el('undoButton').click();assert.equal(state(h).tiles['1,0'].level,2);
});
test('Desktop selection rectangle, group move by button, invalid destination and drag cancellation',async()=>{
 const h=await ui();event(h,'pointerdown',0,1);event(h,'pointermove',1,0);event(h,'pointerup',1,0);assert.match(h.el('inspector').textContent,/2 objects selected/);
 h.action('moveMachine');click(h,0,2);assert.equal(h.el('moveHint').hidden,true);assert.ok(state(h).tiles['0,0']);
 h.action('moveMachine');click(h,2,0);assert.equal(state(h).tiles['0,0'],undefined);assert.equal(state(h).tiles['2,0'].type,'belt');assert.equal(state(h).tiles['3,0'].type,'smelter');
 event(h,'pointerdown',2,0);event(h,'pointermove',2,1);event(h,'pointercancel',2,1);assert.ok(state(h).tiles['2,0']);assert.equal(state(h).tiles['2,1'],undefined);
 event(h,'pointerdown',2,0);event(h,'pointermove',2,1);event(h,'pointerup',2,1);assert.equal(state(h).tiles['2,1'].type,'belt');assert.equal(state(h).tiles['3,1'].type,'smelter');
 const reload=harness(h.mem.get('factory-shift-save-v1'));await settle();assert.equal(reload.el('modalBackdrop').hidden,true);assert.equal(state(reload).tiles['3,1'].type,'smelter');
});
test('Touch tap-selection, move action, pinch and cancellation never accidentally move equipment',async()=>{
 const h=await ui();h.el('multiTool').click();click(h,0,0,{pointerType:'touch'});click(h,1,0,{pointerType:'touch'});assert.match(h.el('inspector').textContent,/2 objects selected/);
 click(h,1,0,{pointerType:'touch'});assert.match(h.el('inspector').textContent,/Conveyor/);click(h,1,0,{pointerType:'touch'});h.action('moveMachine');click(h,0,1,{pointerType:'touch'});assert.ok(state(h).tiles['0,1']);assert.ok(state(h).tiles['1,1']);
 h.el('selectTool').click();event(h,'pointerdown',0,1,{pointerType:'touch'});event(h,'pointermove',2,1,{pointerType:'touch'});event(h,'pointerdown',3,1,{pointerType:'touch',pointerId:2});event(h,'pointerup',3,1,{pointerType:'touch',pointerId:2});event(h,'pointerup',2,1,{pointerType:'touch'});assert.ok(state(h).tiles['0,1']);assert.equal(state(h).tiles['2,1'],undefined);assert.equal(h.el('moveHint').hidden,true);
});
test('Wheel rotates selection once per tick, zoom elsewhere does not rotate; erase drag waits for confirmation',async()=>{
 const h=await ui();click(h,0,0);event(h,'wheel',0,0,{deltaY:100});assert.equal(state(h).tiles['0,0'].dir,1);event(h,'wheel',0,0,{deltaY:100});assert.equal(state(h).tiles['0,0'].dir,1);
 h.advance(.3);event(h,'wheel',1,1,{deltaY:100});assert.equal(state(h).tiles['0,0'].dir,1);h.el('fitButton').click();
 h.el('eraseTool').click();event(h,'pointerdown',0,0);event(h,'pointermove',1,0);assert.ok(state(h).tiles['0,0']);event(h,'pointerup',1,0);assert.match(h.el('modalTitle').textContent,/2 objects/);h.action('closeModal');assert.ok(state(h).tiles['0,0']);
 click(h,0,0);h.action('confirmRecycle');assert.equal(state(h).tiles['0,0'],undefined);assert.ok(state(h).tiles['1,0']);
});

test('Dragging outside the floor pans at fit zoom with any tool, without editing or losing a group',async()=>{
 for(const id of ['selectTool','multiTool','eraseTool',null]){
  const h=await ui();if(id)h.el(id).click();else h.document.querySelectorAll('[data-tool="belt"]')[0].click();
  h.pointer('pointerdown',20,20);h.pointer('pointermove',180,120);h.pointer('pointerup',180,120);
  assert.equal(h.el('modalBackdrop').hidden,true);assert.ok(state(h).tiles['0,0']);assert.equal(state(h).tiles['0,1'],undefined);
  h.document.querySelectorAll('[data-tool="belt"]')[0].click();const p=h.tilePoint(0,1);
  h.pointer('pointerdown',p.x+160,p.y+100);h.pointer('pointerup',p.x+160,p.y+100);assert.equal(state(h).tiles['0,1'].type,'belt');
 }
 const h=await ui();click(h,0,0);click(h,1,0,{shiftKey:true});h.action('moveMachine');
 h.pointer('pointerdown',20,20);h.pointer('pointermove',180,120);h.pointer('pointerup',180,120);
 assert.equal(h.el('moveHint').hidden,false);assert.ok(state(h).tiles['0,0']);assert.ok(state(h).tiles['1,0']);
 const p=h.tilePoint(0,1);h.pointer('pointerdown',p.x+160,p.y+100);h.pointer('pointerup',p.x+160,p.y+100);
 assert.equal(state(h).tiles['0,1'].type,'belt');assert.equal(state(h).tiles['1,1'].type,'smelter');
});
