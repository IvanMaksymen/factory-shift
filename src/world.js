/* Permanent rectangular land purchases; original tile coordinates never move. */
(function(root){
'use strict';
const TYPES={
 industrial:{name:'Industrial',factor:1,ores:2,blocks:0,color:'#385d5b',desc:'Open building space. 2 deposits per 56 tiles; no obstacles.'},
 mining:{name:'Mining',factor:1.25,ores:4,blocks:0,color:'#555c50',desc:'4 deposits per 56 tiles for resource-heavy production.'},
 brownfield:{name:'Abandoned',factor:.75,ores:2,blocks:4,color:'#5e5048',desc:'Discounted land. 2 deposits per 56 tiles and 4 permanent rubble tiles.'},
 legacy:{name:'Original expansion',factor:1,ores:2,blocks:0,color:'#2c4b4d',desc:'Preserved from your previous factory.'}
};
const base=()=>({minX:0,maxX:14,maxY:10});
function rect(bounds,dir){const {minX,maxX,maxY}=bounds;return dir==='left'?{x:minX-4,y:0,w:4,h:maxY}:dir==='right'?{x:maxX,y:0,w:4,h:maxY}:{x:minX,y:maxY,w:maxX-minX,h:4};}
function include(b,r){b.minX=Math.min(b.minX,r.x);b.maxX=Math.max(b.maxX,r.x+r.w);b.maxY=Math.max(b.maxY,r.y+r.h);}
function contains(r,x,y){return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;}
function dock(r,dir){return dir==='left'?`${r.x},${Math.floor(r.h/2)}`:dir==='right'?`${r.x+r.w-1},${Math.floor(r.h/2)}`:`${r.x+r.w-1},${r.y+1}`;}
function connected(r,blocks){
 const blocked=new Set(blocks),start=`${r.x},${r.y}`,visited=new Set([start]),queue=[[r.x,r.y]];
 if(blocked.has(start))return false;
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(contains(r,nx,ny)&&!blocked.has(k)&&!visited.has(k)){visited.add(k);queue.push([nx,ny]);}}}
 return visited.size===r.w*r.h-blocked.size;
}
function oreCount(r,type=r.type){return Math.max(1,Math.round(r.w*r.h*TYPES[type].ores/56));}
function legacy(count){return Array.from({length:count},(_,i)=>({x:0,y:10+i*4,w:14,h:4,direction:'down',type:'legacy',blocks:[],dock:`13,${11+i*4}`}));}
function compile(lands){const b=base(),docks=new Set(['13,2','13,6','13,8']),blocked=new Set(['6,4','7,4','6,5','7,5']);for(const l of lands){include(b,l);if(l.dock!==null)docks.add(l.dock);for(const k of l.blocks)blocked.add(k);}return {...b,docks,blocked};}
function validate(lands,count){
 if(!Array.isArray(lands)||lands.length!==count)throw Error('Invalid purchased land.');
 const b=base();
 for(const l of lands){
  if(!l||!['left','right','down'].includes(l.direction)||!Object.hasOwn(TYPES,l.type))throw Error('Invalid land type.');
  const expected=rect(b,l.direction);
  for(const prop of ['x','y','w','h'])if(l[prop]!==expected[prop])throw Error('Invalid land boundaries.');
  if(l.type==='legacy'&&(l.direction!=='down'||l.x!==0||l.w!==14))throw Error('Invalid legacy land.');
  if((l.dock!==null&&l.dock!==dock(l,l.direction))||!Array.isArray(l.blocks)||l.blocks.length!==TYPES[l.type].blocks||new Set(l.blocks).size!==l.blocks.length)throw Error('Invalid land structures.');
  for(const k of l.blocks){if(typeof k!=='string')throw Error('Invalid rubble.');const [x,y]=k.split(',').map(Number);if(!Number.isInteger(x)||!Number.isInteger(y)||k!==`${x},${y}`||!contains(l,x,y)||k===l.dock)throw Error('Invalid rubble.');}
  if(l.blocks.length&&!connected(l,l.blocks))throw Error('Disconnected land.');
  include(b,l);
 }
 return compile(lands);
}
root.FactoryWorld={TYPES,base,rect,include,contains,dock,connected,oreCount,legacy,compile,validate};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FactoryWorld;
})(typeof globalThis!=='undefined'?globalThis:this);
