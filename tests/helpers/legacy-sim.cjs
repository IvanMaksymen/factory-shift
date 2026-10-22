const F=require('../../src/sim.js');
function fresh(seed){const s=F.fresh(seed);s.startLayout='legacy';s.deposits={'1,2':'ore','1,6':'ore','4,8':'copperOre','9,8':'copperOre'};return s;}
class Simulation extends F.Simulation{constructor(state=fresh()){super(state);}}
module.exports={...F,fresh,Simulation};
