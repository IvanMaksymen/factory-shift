/* Internal raster QA of the actual Canvas renderer, without a browser. */
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/@napi-rs/canvas');
const F = require('./helpers/legacy-sim.cjs');
const A = require('../src/render.js');
const out = path.resolve(__dirname, '../../qa'); fs.mkdirSync(out, { recursive: true });
const sim = new F.Simulation();
const canvas = createCanvas(1100, 720); const render = new A.Renderer(canvas);
render.resize(1100, 720); render.tool = 'belt'; render.hover = { x: 4, y: 2 };
render.render(sim, 1, 0); fs.writeFileSync(path.join(out, 'factory-first-shift.png'), canvas.toBuffer('image/png'));
sim.place('belt',4,2); sim.s.stage=5; sim.s.coins=2000; sim.place('press',6,2); sim.setRecipe(6,2,'gear');
sim.place('drill',4,8,3); sim.place('smelter',4,7); sim.place('wiremill',5,7);
for(let x=6;x<=12;x++)sim.place('belt',x,7,x===12?1:0); sim.place('belt',12,8); sim.research('power');
for(let i=0;i<650;i++) sim.step(.05);
render.tool='select'; render.hover=null; render.selected={x:6,y:2}; render.render(sim,sim.s.time,0);
fs.writeFileSync(path.join(out, 'factory-production.png'), canvas.toBuffer('image/png'));
const icons=createCanvas(960,1140), c=icons.getContext('2d'); c.fillStyle='#e9e3cc';c.fillRect(0,0,960,1140);
Object.keys(F.BUILD).forEach((type,i)=>{c.save();c.translate(46+(i%6)*158,12+Math.floor(i/6)*115);A.machine(c,{...F.tile(type,0,0),job:{seconds:2},progress:1},2,true,true);A.text(c,F.BUILD[type].name,32,79,11,'#254c4e','center');c.restore();});
Object.keys(F.ITEMS).forEach((type,i)=>{const x=60+(i%8)*119,y=720+Math.floor(i/8)*65;A.item(c,type,x,y,1.4);A.text(c,F.ITEMS[type].name,x,y+27,9,'#254c4e','center');});
fs.writeFileSync(path.join(out,'factory-art-atlas.png'),icons.toBuffer('image/png'));
for(const [w,h] of [[821,300],[390,490],[800,270]]){
  render.resize(w,h,2);render.fit();render.render(sim,5,0);render.zoomBy(2);render.render(sim,6,0);
  const screenX=render.ox+(4.5)*A.CELL*render.scale,screenY=render.oy+2.5*A.CELL*render.scale;
  const cell=render.cellAt(screenX,screenY);if(cell.x!==4||cell.y!==2)throw Error('Coordinate transform failed');
}
sim.s.coins=1000000;while(sim.expand()){}render.resize(900,1100);render.fit();render.render(sim,6,0);fs.writeFileSync(path.join(out,'factory-expanded.png'),canvas.toBuffer('image/png'));
render.focusTile(6,sim.height-3);render.render(sim,6,0);fs.writeFileSync(path.join(out,'factory-new-land.png'),canvas.toBuffer('image/png'));
console.log('Canvas renderer passed desktop/mobile raster checks; coordinate transforms passed.');

const mixed=new F.Simulation(F.fresh(717));mixed.s.coins=1e7;mixed.s.stage=39;
mixed.expand('left','mining');mixed.expand('left','industrial');mixed.expand('down','brownfield');
render.resize(1100,720);render.syncWorld(mixed);render.fit();render.selected=null;render.render(mixed,7,0);fs.writeFileSync(path.join(out,'factory-mixed-land.png'),canvas.toBuffer('image/png'));
render.resize(390,490,2);render.fit();render.render(mixed,7,0);fs.writeFileSync(path.join(out,'factory-mixed-phone.png'),canvas.toBuffer('image/png'));
