const test=require('node:test'),assert=require('node:assert/strict'),F=require('../src/sim.js');
const {harness,settle}=require('./helpers/ui-harness.cjs');
async function setup(tool){const s=new F.Simulation();s.s.started=true;s.s.stage=10;s.s.coins=10000;s.s.tutorial=false;const h=harness(s.serialize());await settle();h.document.querySelectorAll('[data-tool="'+tool+'"]')[0].click();return h;}
function event(h,type,x,y,extra={}){const p=h.tilePoint(x,y);h.el('factoryCanvas').emit(type,{pointerId:1,button:0,pointerType:'touch',clientX:p.x,clientY:p.y,...extra});}
function tap(h,x,y){event(h,'pointerdown',x,y);event(h,'pointerup',x,y);}
function state(h){return JSON.parse(h.mem.get('factory-shift-save-v1'));}
for(const tool of ['belt','fastbelt']){
 test(tool+': touch taps automatically connect adjacent pieces around corners',async()=>{
  const h=await setup(tool);tap(h,0,0);tap(h,1,0);tap(h,1,1);
  assert.equal(state(h).tiles['0,0'].dir,0);assert.equal(state(h).tiles['1,0'].dir,1);assert.equal(state(h).tiles['1,1'].dir,1);
  h.el('undoButton').click();assert.equal(state(h).tiles['1,1'],undefined);assert.equal(state(h).tiles['1,0'].dir,0);
 });
 test(tool+': drag follows turns and processes final pointer-up position',async()=>{
  const h=await setup(tool);event(h,'pointerdown',0,0);event(h,'pointermove',2,0);event(h,'pointerup',2,1);
  const s=state(h);assert.equal(s.tiles['1,0'].dir,0);assert.equal(s.tiles['2,0'].dir,1);assert.equal(s.tiles['2,1'].type,tool);
  h.el('undoButton').click();assert.equal(state(h).tiles['0,0'],undefined);assert.equal(state(h).tiles['2,1'],undefined);
 });
}
test('touch jitter inside one tile places a machine and Inspect drag does not move it',async()=>{
 const h=await setup('smelter');const p=h.tilePoint(0,0);event(h,'pointerdown',0,0);h.el('factoryCanvas').emit('pointermove',{pointerId:1,pointerType:'touch',clientX:p.x+8,clientY:p.y});event(h,'pointerup',0,0);
 assert.equal(state(h).tiles['0,0'].type,'smelter');
 h.el('selectTool').click();event(h,'pointerdown',0,0);event(h,'pointermove',0,1);event(h,'pointerup',0,1);assert.equal(state(h).tiles['0,0'].type,'smelter');assert.equal(state(h).tiles['0,1'],undefined);
});
