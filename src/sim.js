/* Factory Shift — deterministic, dependency-free simulation. */
(function (root) {
  'use strict';
  const C = root.FactoryContent || (typeof require !== 'undefined' ? require('./content.js') : null);
  const World = root.FactoryWorld || (typeof require !== 'undefined' ? require('./world.js') : null);
  const MAX_LAND = 24, MAX_LEVEL = 11, MAX_RESEARCH = 20;
  const W = 14, H = 10, VERSION = 1, STEP = .05;
  const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const ITEMS = {
    ore: { name: 'Iron ore', color: '#8aa6b6', value: 1 },
    copperOre: { name: 'Copper ore', color: '#d68a57', value: 1 },
    iron: { name: 'Iron ingot', color: '#b7d7df', value: 4 },
    copper: { name: 'Copper ingot', color: '#efb274', value: 5 },
    plate: { name: 'Steel plate', color: '#9ccbd4', value: 8 },
    gear: { name: 'Gear', color: '#c6d8da', value: 11 },
    wire: { name: 'Copper wire', color: '#ffc279', value: 10 },
    rod: { name: 'Steel rod', color: '#a8d4dd', value: 12 },
    casing: { name: 'Housing', color: '#d4b99a', value: 22 },
    circuit: { name: 'Circuit board', color: '#84d3a2', value: 36 },
    robot: { name: 'Service robot', color: '#c9b0f3', value: 155 },
    motor: { name: 'Motor', color: '#b2a6ef', value: 62 }
  };
  const BUILD = {
    belt: { name: 'Conveyor', cost: 8, power: 0, unlock: 0, color: '#899b9d', tip: 'Carries one item. Drag to draw a route.' },
    drill: { name: 'Extractor', cost: 90, power: 2, unlock: 0, color: '#dfb95c', tip: 'Place on a marked iron or copper deposit.' },
    smelter: { name: 'Smelter', cost: 110, power: 3, unlock: 0, color: '#ec9371', tip: 'Iron ore → iron. Copper ore → copper.' },
    press: { name: 'Press', cost: 100, power: 2, unlock: 1, color: '#85bdbc', tip: 'Iron → plates or gears. Select to change recipe.' },
    splitter: { name: 'Splitter', cost: 35, power: 0, unlock: 2, color: '#93b68a', tip: 'Alternates items between its two side exits.' },
    wiremill: { name: 'Wire mill', cost: 130, power: 2, unlock: 3, color: '#e7b979', tip: 'Copper ingot → copper wire.' },
    assembler: { name: 'Assembler', cost: 240, power: 4, unlock: 5, color: '#b7a2d9', tip: '2 gears + 2 wires → 1 motor. Feed from two sides.' }
  };
  Object.assign(BUILD, {
    fastbelt: { name: 'Express belt', cost: 24, power: 0, unlock: 2, color: '#70c3cb', tip: 'Moves goods twice as fast as a normal conveyor.' },
    cutter: { name: 'Rod cutter', cost: 150, power: 2, unlock: 2, color: '#92bcd1', tip: 'Iron → steel rod. Sell for 12 credits.' },
    polisher: { name: 'Housing press', cost: 190, power: 3, unlock: 3, color: '#d1b394', tip: 'Steel plate → housing. Sell for 22 credits.' },
    electronics: { name: 'Circuit bench', cost: 260, power: 3, unlock: 4, color: '#8abf9c', tip: '1 plate + 2 wires → circuit board. Feed from different sides.' },
    fabricator: { name: 'Robot lab', cost: 420, power: 5, unlock: 6, color: '#b9a3dd', tip: '1 motor + 1 circuit + 1 housing → service robot. Three inputs.' }
  });
  const transport = t => ['belt', 'fastbelt', 'splitter'].includes(t.type);
  const RECIPES = {
    rod: { need: { iron: 1 }, out: 'rod', seconds: 2.6 },
    casing: { need: { plate: 1 }, out: 'casing', seconds: 3.2 },
    circuit: { need: { plate: 1, wire: 2 }, out: 'circuit', seconds: 4 },
    robot: { need: { motor: 1, circuit: 1, casing: 1 }, out: 'robot', seconds: 6 },
    iron: { need: { ore: 1 }, out: 'iron', seconds: 1.9 },
    copper: { need: { copperOre: 1 }, out: 'copper', seconds: 1.9 },
    plate: { need: { iron: 1 }, out: 'plate', seconds: 2.4 },
    gear: { need: { iron: 1 }, out: 'gear', seconds: 3.1 },
    wire: { need: { copper: 1 }, out: 'wire', seconds: 2.2 },
    motor: { need: { gear: 2, wire: 2 }, out: 'motor', seconds: 4.8 }
  };
  const ORES = { ore: { symbol: 'Fe', color: '#8aa6b6', weight: 14 }, copperOre: { symbol: 'Cu', color: '#d68a57', weight: 10 } };
  C.metals.forEach(([id,name,symbol,color,value,weight]) => {
    ITEMS[id+'Ore'] = { name: name+' ore', color, value: Math.max(1, Math.floor(value/4)) };
    ITEMS[id] = { name, color, value };
    ORES[id+'Ore'] = { symbol, color, weight };
  });
  C.machines.forEach(([id,name,need,outName,value,seconds,cost,power,unlock,group],i) => {
    const out = C.outputs[i], color = ITEMS[out]?.color || ['#a6c9bc','#d6b587','#98b6d5','#c2a4d4'][i%4];
    ITEMS[out] = { name: outName, color, value };
    RECIPES[out] = { need, out, seconds, unlock };
    BUILD[id] = { name, cost, power, unlock, color, group, recipes: [out], glyph: i%6,
      tip: Object.entries(need).map(([k,n])=>n+' '+(ITEMS[k]?.name || k)).join(' + ')+' → '+outName+'.' };
  });
  C.alloys.forEach(([id,name,need,value,unlock,color]) => {
    ITEMS[id] = { name, value, color }; RECIPES[id] = { need, out: id, seconds: 4.2, unlock };
  });
  BUILD.alloyFurnace.recipes = C.alloys.map(a=>a[0]);
  BUILD.alloyFurnace.tip = 'Combine ingots into 6 alloys. Inspect the furnace to choose a recipe.';
  BUILD.drill.tip = 'Place on any marked ore deposit. Sends that ore through its output arrow.';
  const recipeText = id => Object.entries(RECIPES[id].need).map(([k,n])=>n+' '+ITEMS[k].name).join(' + ')+' → 1 '+ITEMS[RECIPES[id].out].name;
  for (const [type,d] of Object.entries(BUILD)) {
    d.group ||= transport({type}) ? 'logistics' : ['assembler','electronics','fabricator'].includes(type) ? 'advanced' : 'production';
    d.recipes ||= ({smelter:['iron','copper'],press:['plate','gear'],wiremill:['wire'],assembler:['motor'],cutter:['rod'],polisher:['casing'],electronics:['circuit'],fabricator:['robot']}[type] || []);
    if (d.glyph !== undefined && type!=='alloyFurnace') d.tip = recipeText(d.recipes[0])+'.';
    d.placement = type==='drill' ? 'Only on a marked ore deposit. Turn the arrow toward your refinery.' : type==='splitter' ? 'Between conveyors. Input from the back; outputs use the two side exits.' : transport({type}) ? 'On empty floor between machines. The arrow points to the next tile.' : 'On empty floor, or replace a normal conveyor. Feed ingredients from the back or either side; the arrow is output only.';
  }
  const DEPOSITS = { '1,2': 'ore', '1,6': 'ore', '4,8': 'copperOre', '9,8': 'copperOre' };
  const BLOCKED = new Set(['6,4', '7,4', '6,5', '7,5']);
  const DOCKS = new Set(['13,2', '13,6', '13,8']);
  for (let level = 1; level <= MAX_LAND; level++) { const y = 10 + (level - 1) * 4 + 1; DEPOSITS[`1,${y}`] = 'ore'; DEPOSITS[`5,${y + 1}`] = 'copperOre'; DOCKS.add(`13,${y}`); }
  const CONTRACTS = [
    { title: 'First things first', client: 'THE LOCAL WORKSHOP', need: { iron: 8 }, reward: 180, par: 60, hint: 'Connect the glowing gap with a conveyor. Ingots will travel to the shipping dock.', unlock: 'Press unlocked' },
    { title: 'A solid foundation', client: 'NORTHSIDE CONSTRUCTION', need: { plate: 12 }, reward: 260, par: 100, hint: 'Replace a conveyor after the smelter with a Press. Its default recipe is steel plates.', unlock: 'Gears & splitter unlocked' },
    { title: 'Keep it turning', client: 'THE CLOCKWORK CO.', need: { gear: 12 }, reward: 320, par: 110, hint: 'Select your Press with the inspect tool. Switch its recipe from plates to gears.', unlock: 'Wire mill unlocked' },
    { title: 'A little conductivity', client: 'AMBER ELECTRICS', need: { wire: 18 }, reward: 480, par: 140, hint: 'Build a second line: copper deposit → Extractor → Smelter → Wire mill → dock.', unlock: 'Parallel contracts unlocked' },
    { title: 'Two lines, one shift', client: 'CITY TRANSIT', need: { gear: 18, wire: 24 }, reward: 600, par: 160, hint: 'Keep both production lines running. Upgrade individual machines to clear bottlenecks.', unlock: 'Assembler unlocked' },
    { title: 'The heart of the machine', client: 'PULSE ROBOTICS', need: { motor: 6 }, reward: 800, par: 200, hint: 'Route gears and wires into different sides of an Assembler. Every motor uses two of each.', unlock: 'Efficiency contracts unlocked' },
    { title: 'Built for the city', client: 'METRO ENGINEERING', need: { plate: 24, motor: 8 }, reward: 1050, par: 240, hint: 'Split iron between a plate Press and a gear Press. Keep your motor assembly supplied.', unlock: 'Master contract unlocked' },
    { title: 'The perfect shift', client: 'FACTORY GUILD', need: { plate: 24, gear: 24, wire: 30, motor: 10 }, reward: 1500, par: 300, hint: 'Balance shipping and assembly. Splitters let you share one line between two destinations.', unlock: 'Endless shifts unlocked' }
  ];
  CONTRACTS[7].unlock = 'Metallurgy chapter unlocked';
  C.missions.forEach(([title,need,hint],i) => {
    const stage = i+8;
    CONTRACTS.push({title,need,hint,client:['METALWORKS GUILD','NEW CITY INDUSTRIES','ORBITAL RESEARCH','PRECISION EXPORTS'][i%4],reward:1600+i*230,par:240+i*16,unlock:stage===39?'Endless contracts unlocked':'New shift & equipment'});
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = (x, y) => `${x},${y}`;
  const finite = (n, min = 0, max = 1e12) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  function contract(stage) {
    if (stage < CONTRACTS.length) return clone(CONTRACTS[stage]);
    const templates = [
      { title: 'District supply', client: 'ECO DISTRICT', need: { motor: 12, rod: 30, casing: 12 }, hint: 'Ship rods and housings alongside motors.' },
      { title: 'Copper country', client: 'AMBER ELECTRICS', need: { wire: 60, circuit: 14 }, modifier: 'copper', hint: 'Copper shift: wire deliveries earn 50% more. Combine plates and wire at the Circuit bench.' },
      { title: 'Precision in motion', client: 'CLOCKWORK EXPORTS', need: { gear: 40, plate: 24, robot: 6 }, hint: 'Build robots from motors, circuits and housings.' }
    ];
    const c = clone(templates[(stage - CONTRACTS.length) % templates.length]);
    const factor = 1 + Math.floor((stage - CONTRACTS.length) / 3) * .18;
    for (const item in c.need) c.need[item] = Math.ceil(c.need[item] * factor);
    return { ...c, reward: 1400 + (stage - CONTRACTS.length) * 160, par: 300 + (stage - CONTRACTS.length) * 12, unlock: 'New rotating contract' };
  }
  function tile(type, x, y, dir = 0, paid = 0) {
    return { type, x, y, dir, paid, freeBase: paid === 0, level: 1, input: {}, out: null, job: null, progress: 0, recipe: BUILD[type].recipes?.[0] || 'plate', turn: 0, blocked: false };
  }
  function random(s) { s.rng = (Math.imul(s.rng,1664525)+1013904223) >>> 0; return s.rng / 4294967296; }
  function fresh(seed = (Math.random()*4294967296) >>> 0) {
    const s = { version: VERSION, contentVersion: 8, startLayout: 'random', lands: [], side: { round:0, completed:0, offers:[], active:null, stage:-1 }, rng: seed >>> 0, deposits: Object.fromEntries(Object.entries(DEPOSITS).filter(([k])=>Number(k.split(',')[1])<H)), expansion: 0, coins: 240, stage: 0, tiles: {}, spares: {}, delivered: {}, elapsed: 0, time: 0, powerLevel: 0, speedLevel: 0, beltLevel: 0, totalShipped: 0, totalEarned: 0, totalMade: 0, medals: 0, records: [], started: false, tutorial: true, sound: true, savedAt: 0, offlineEligible: false };
    s.tiles['1,2'] = tile('drill', 1, 2);
    s.tiles['2,2'] = tile('belt', 2, 2);
    s.tiles['3,2'] = tile('smelter', 3, 2);
    for (let x = 5; x <= 12; x++) s.tiles[key(x, 2)] = tile('belt', x, 2);
    // Keep the teaching line, randomize the rest of the starting geology.
    s.deposits={'1,2':'ore'};
    const candidates=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=key(x,y);if(!s.tiles[k]&&!BLOCKED.has(k)&&!DOCKS.has(k)&&k!=='4,2')candidates.push(k);}
    for(const kind of ['ore','copperOre','copperOre',null,null]){
      const k=candidates.splice(Math.floor(random(s)*candidates.length),1)[0];
      s.deposits[k]=kind || randomOre(s);
    }
    return s;
  }
  function randomOre(s) { const pool=Object.entries(ORES);let roll=random(s)*pool.reduce((n,[,d])=>n+d.weight,0);for(const [ore,d]of pool){roll-=d.weight;if(roll<0)return ore;}return pool[pool.length-1][0]; }
  class Simulation {
    constructor(state = fresh()) { this.s = state; this.events = []; this.history = []; this.recent = []; this.phase = 0; this.world=World.compile(state.lands || []); }
    get height() { return this.world.maxY; }
    get width() { return this.world.maxX-this.world.minX; }
    get docks() { return this.world.docks; }
    get blocked() { return this.world.blocked; }
    inside(x,y) { return x>=this.world.minX && x<this.world.maxX && y>=0 && y<this.height; }
    get expansionCost() { return this.landOffer('down','industrial').cost; }
    landOffer(direction='down',type='industrial') {
      if(!['left','down'].includes(direction)||!['industrial','mining','brownfield'].includes(type))return null;
      const r=World.rect(this.world,direction), n=this.s.expansion;
      const base=[500,1400,3200][n] || Math.round(3200*Math.pow(1.22,n-2));
      return {...r,direction,type,oreCount:World.oreCount(r,type),cost:n>=MAX_LAND?0:Math.ceil(base*r.w*r.h/56*World.TYPES[type].factor/10)*10};
    }
    get deposits() { return this.s.deposits; }
    isExpansionDeposit(k) { const [x,y]=k.split(',').map(Number);return this.s.lands.some(l=>World.contains(l,x,y)); }
    surveyCost(kind) { return Object.hasOwn(ORES,kind) ? 200 + Math.round(1600 / ORES[kind].weight) : Infinity; }
    survey(k,kind) {
      if (this.s.stage < 8 || !Object.hasOwn(ORES,kind) || !Object.hasOwn(this.deposits,k) || !this.isExpansionDeposit(k) || this.s.tiles[k] || this.deposits[k]===kind || this.s.coins<this.surveyCost(kind)) return false;
      this.s.coins-=this.surveyCost(kind); this.deposits[k]=kind; this.history=[]; return true;
    }
    expand(direction='down',type='industrial') {
      const offer=this.landOffer(direction,type);
      if(!offer||this.s.expansion>=MAX_LAND||this.s.coins<offer.cost)return false;
      const {cost,...land}=offer;land.blocks=[];land.dock=null;
      const candidates=[];
      for(let y=land.y;y<land.y+land.h;y++)for(let x=land.x;x<land.x+land.w;x++)if(key(x,y)!==land.dock)candidates.push([x,y]);
      const take=()=>candidates.splice(Math.floor(random(this.s)*candidates.length),1)[0];
      const def=World.TYPES[type],pool=Object.entries(ORES),total=pool.reduce((n,[,d])=>n+d.weight,0);
      for(let i=0;i<land.oreCount;i++){
        const [x,y]=take();let roll=random(this.s)*total,kind=pool[pool.length-1][0];
        for(const [ore,d]of pool){roll-=d.weight;if(roll<0){kind=ore;break;}}
        this.deposits[key(x,y)]=kind;
      }
      // Rubble stays away from the dock and strip edges so every parcel remains reachable.
      for(let i=0;i<def.blocks;i++){
        const valid=candidates.filter(([x,y])=>x>land.x&&x<land.x+land.w-1&&y>land.y&&y<land.y+land.h-1&&World.connected(land,[...land.blocks,key(x,y)]));
        const point=valid[Math.floor(random(this.s)*valid.length)];land.blocks.push(key(...point));candidates.splice(candidates.indexOf(point),1);
      }
      this.s.coins-=cost;this.s.lands.push(land);this.s.expansion++;this.world=World.compile(this.s.lands);this.history=[];
      this.emit('expand',{direction,type});return true;
    }
    sideOffers() {
      const board=this.s.side;
      if(board.active || (board.offers.length===3&&board.stage===this.s.stage))return board.offers;
      const available=Object.keys(RECIPES).filter(id=>(RECIPES[id].unlock||0)<=this.s.stage&&(id!=='gear'||this.s.stage>=2)&&Object.values(BUILD).some(d=>d.unlock<=this.s.stage&&d.recipes.includes(id)));
      let seed=((this.s.stage+1)*2654435761+board.round*1013904223)>>>0;
      const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const pool=[...available];
      board.offers=Array.from({length:3},(_,i)=>{
        if(!pool.length)pool.push(...available);
        const id=pool.splice(Math.floor(rand()*pool.length),1)[0];
        const q=Math.max(3,Math.ceil((80+this.s.stage*22)*(1+i*.6)/Math.sqrt(ITEMS[id].value*8)));
        const need={[id]:q};
        if(i===2&&available.length>1){const other=available.filter(k=>k!==id)[Math.floor(rand()*(available.length-1))];need[other]=Math.max(3,Math.ceil(q*ITEMS[id].value/ITEMS[other].value/2));}
        const worth=Object.entries(need).reduce((n,[k,v])=>n+ITEMS[k].value*v,0);
        return {id:`${this.s.stage}-${board.round}-${i}`,title:['Workshop request','Bulk supply','Mixed shipment'][i],need,reward:Math.round(worth*.2+40),progress:{}};
      });board.stage=this.s.stage;return board.offers;
    }
    acceptSide(id) { if(this.s.side.active)return false;const offer=this.sideOffers().find(o=>o.id===id);if(!offer)return false;this.s.side.active=clone(offer);return true; }
    get sideReady() { const a=this.s.side.active;return !!a&&Object.entries(a.need).every(([k,n])=>(a.progress[k]||0)>=n); }
    claimSide() { if(!this.sideReady)return null;const a=this.s.side.active;this.s.coins+=a.reward;this.s.totalEarned+=a.reward;this.s.side.active=null;this.s.side.offers=[];this.s.side.round++;this.s.side.completed++;this.emit('sideComplete');return a; }
    abandonSide() { if(!this.s.side.active)return false;this.s.side.active=null;return true; }
    saleValue(kind) {
      return Math.round(ITEMS[kind].value*(kind==='wire'&&this.order.modifier==='copper'?1.5:1)*100)/100;
    }

    get order() { if (this._stage !== this.s.stage) { this._stage = this.s.stage; this._order = contract(this.s.stage); } return this._order; }
    get ready() { return Object.entries(this.order.need).every(([i, q]) => (this.s.delivered[i] || 0) >= q); }
    get rate() { return this.recent.filter(t => t > this.s.time - 30).length * 2; }
    emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 60) this.events.shift(); }
    checkpoint() {
      this.history.push({ tiles: clone(this.s.tiles), spares: clone(this.s.spares), stage: this.s.stage });
      if (this.history.length > 30) this.history.shift();
    }
    undo() {
      const h = this.history.pop();
      if (!h || h.stage !== this.s.stage) return false;
      // Preserve revenue earned since the edit; never rewind deliveries or paid rewards.
      const currentInvestment = Object.values(this.s.tiles).reduce((n, t) => n + t.paid, 0);
      const oldInvestment = Object.values(h.tiles).reduce((n, t) => n + t.paid, 0);
      if (this.s.coins + currentInvestment - oldInvestment < 0) { this.history.push(h); return false; }
      this.s.coins += currentInvestment - oldInvestment;
      this.s.tiles = h.tiles;
      this.s.spares = h.spares;
      // Edited routes can be restored, but stored materials cannot be duplicated.
      for (const t of Object.values(this.s.tiles)) { t.input = {}; t.out = null; t.job = null; t.progress = 0; }
      return true;
    }
    buildCost(type) { return (this.s.spares[type] || 0) > 0 ? 0 : BUILD[type].cost; }
    allowed(type, x, y) {
      if (!Object.hasOwn(BUILD, type) || !Number.isInteger(x) || !Number.isInteger(y) || !this.inside(x,y)) return 'Outside the factory floor';
      if (this.s.stage < BUILD[type].unlock) return `Unlocks after shift ${BUILD[type].unlock}`;
      if (this.blocked.has(key(x, y))) return 'Permanent structure or rubble — route around this tile';
      if (this.docks.has(key(x, y))) return 'Keep shipping docks clear';
      if (type === 'drill' && !this.deposits[key(x, y)]) return 'Place extractors on a marked ore deposit';
      const old = this.s.tiles[key(x, y)];
      if (old && old.type !== 'belt') return 'Inspect or recycle this machine first';
      if (this.s.coins + (old?.paid || 0) < this.buildCost(type)) return 'Not enough credits — keep shipping or recycle equipment';
      return '';
    }
    place(type, x, y, dir = 0, record = true) {
      if (!Number.isInteger(dir) || dir < 0 || dir > 3) return 'Invalid output direction';
      const old = this.s.tiles[key(x, y)];
      if (old?.type === 'belt' && type === 'belt') { if (old.dir === dir) return ''; if (record) this.checkpoint(); old.dir = dir; return ''; }
      const error = this.allowed(type, x, y); if (error) return error;
      if (record) this.checkpoint();
      const cost = this.buildCost(type);
      if (cost === 0) this.s.spares[type]--;
      if (old?.freeBase) this.s.spares[old.type] = (this.s.spares[old.type] || 0) + 1;
      this.s.coins += (old?.paid || 0) - cost;
      this.s.tiles[key(x, y)] = tile(type, x, y, dir, cost);
      this.emit('build', { x, y }); return '';
    }
    remove(x, y, record = true) {
      const t = this.s.tiles[key(x, y)]; if (!t) return false;
      if (record) this.checkpoint(); this.s.coins += t.paid;
      if (t.freeBase) this.s.spares[t.type] = (this.s.spares[t.type] || 0) + 1;
      delete this.s.tiles[key(x, y)]; return true;
    }
    rotate(x, y) { const t = this.s.tiles[key(x, y)]; if (!t) return; this.checkpoint(); t.dir = (t.dir + 1) % 4; }
    setRecipe(x, y, recipe) {
      const t = this.s.tiles[key(x, y)];
      if (!t || !['press','alloyFurnace'].includes(t.type) || t.recipe === recipe || !BUILD[t.type].recipes.includes(recipe) || (recipe === 'gear' && this.s.stage < 2) || (RECIPES[recipe].unlock || 0)>this.s.stage) return false;
      this.checkpoint(); t.recipe = recipe; return true;
    }
    upgradeCost(t) { return Math.round(Math.round(BUILD[t.type].cost * .7) * Math.pow(1.5,t.level-1)); }
    upgrade(x, y) {
      const t = this.s.tiles[key(x, y)];
      if (!t || t.level >= MAX_LEVEL || this.speedBonus(t,transport(t)) >= 2) return false;
      const cost = this.upgradeCost(t); if (this.s.coins < cost) return false;
      this.checkpoint(); this.s.coins -= cost; t.paid += cost; t.level++; return true;
    }
    // Old research levels remain readable in saves but no longer alter gameplay.
    research() { return false; }
    speedBonus(t) { return Math.min(2,1+(t.level-1)*.1); }
    productionSpeed(t) { return this.speedBonus(t); }
    recipes(t) { return ['press','alloyFurnace'].includes(t.type) ? [t.recipe] : BUILD[t.type].recipes; }
    travel(t) { return .44 / ((t.type === 'fastbelt' ? 2 : 1) * this.speedBonus(t,true)); }
    accepts(t, kind, incomingDirection) {
      if (!t || t.type === 'drill') return false;
      // Machines take materials from every side except their output port.
      if (incomingDirection === (t.dir + 2) % 4) return false;
      if (transport(t)) return !t.out;
      return this.recipes(t).some(r => RECIPES[r].need[kind]) && (t.input[kind] || 0) < 4;
    }
    deliver(kind, x, y) {
      const value = this.saleValue(kind);
      this.s.coins = Math.round((this.s.coins+value)*100)/100; this.s.totalEarned = Math.round((this.s.totalEarned+value)*100)/100; this.s.totalShipped++;
      this.s.delivered[kind] = (this.s.delivered[kind] || 0) + 1;
      const side=this.s.side.active;if(side&&Object.hasOwn(side.need,kind))side.progress[kind]=Math.min(side.need[kind],(side.progress[kind]||0)+1);
      this.recent.push(this.s.time); this.emit('ship', { kind, value, x, y });
    }
    step(dt) {
      if (!finite(dt, 0, .25) || dt === 0) return;
      const s = this.s, wasReady = this.ready;
      s.time += dt; if (!wasReady) s.elapsed += dt;
      const list = Object.values(s.tiles);
      const moves = [];
      for (const t of list) {
        t.blocked = false;
        if (t.out) {
          t.out.age += dt;
          const travel = transport(t) ? this.travel(t) : .18;
          if (t.out.age >= travel) moves.push(t);
        }
      }
      // Rotate traversal for fair merges; received items never move twice in one step.
      if (moves.length) { const offset = this.phase++ % moves.length; moves.push(...moves.splice(0, offset)); }
      for (const t of moves) {
        if (!t.out) continue;
        let exits = [t.dir];
        if (t.type === 'splitter') exits = t.turn ? [(t.dir + 3) % 4, (t.dir + 1) % 4] : [(t.dir + 1) % 4, (t.dir + 3) % 4];
        let moved = false;
        for (const d of exits) {
          const x = t.x + DIR[d][0], y = t.y + DIR[d][1], k = key(x, y), dest = s.tiles[k];
          if (this.docks.has(k)) { this.deliver(t.out.kind, x, y); moved = true; }
          else if (this.accepts(dest, t.out.kind, d)) {
            if (transport(dest)) dest.out = { kind: t.out.kind, age: 0, from: d };
            else dest.input[t.out.kind] = (dest.input[t.out.kind] || 0) + 1;
            moved = true;
          }
          if (moved) { t.out = null; if (t.type === 'splitter') t.turn = 1 - t.turn; break; }
        }
        if (!moved) t.blocked = true;
      }
      for (const t of list) {
        if (transport(t) || t.out) continue;
        const speed = this.productionSpeed(t);
        if (!t.job) {
          if (t.type === 'drill') t.job = { out: this.deposits[key(t.x, t.y)], seconds: 2.2 };
          else {
            const r = this.recipes(t).map(n => RECIPES[n]).find(r => Object.entries(r.need).every(([i, q]) => (t.input[i] || 0) >= q));
            if (!r) continue;
            for (const [i, q] of Object.entries(r.need)) t.input[i] -= q;
            t.job = { out: r.out, seconds: r.seconds };
          }
        }
        t.progress += dt * speed;
        if (t.progress >= t.job.seconds) {
          t.out = { kind: t.job.out, age: 0, from: t.dir }; t.progress = 0; t.job = null; s.totalMade++;
        }
      }
      this.recent = this.recent.filter(t => t > s.time - 30);
      if (!wasReady && this.ready) this.emit('ready');
    }
    complete() {
      if (!this.ready) return null;
      const c = this.order, stars = this.s.elapsed <= c.par ? 3 : this.s.elapsed <= c.par * 1.7 ? 2 : 1;
      const bonus = Math.round(c.reward * (stars === 3 ? .4 : stars === 2 ? .2 : 0));
      const result = { stage: this.s.stage, title: c.title, seconds: this.s.elapsed, stars, reward: c.reward, bonus, unlock: c.unlock };
      this.s.coins += c.reward + bonus; this.s.totalEarned += c.reward + bonus; this.s.medals += stars;
      this.s.records.push(result); if (this.s.records.length > 100) this.s.records.shift();
      this.s.stage++; this.s.elapsed = 0; this.s.delivered = {}; this.history = []; this.emit('complete', result); return result;
    }
    offline(seconds) {
      const duration = Math.min(300, Math.max(0, Number(seconds) || 0)), before = this.s.coins;
      const ticks = Math.floor((duration + 1e-9) / STEP);
      for (let t = 0; t < ticks; t++) this.step(STEP);
      this.events = []; return { seconds: duration, coins: this.s.coins - before };
    }
    serialize() { return JSON.stringify(this.s); }
    static parse(raw) {
      const s = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
      if (!s || s.version !== VERSION || !finite(s.coins) || !Number.isInteger(s.stage) || !finite(s.stage, 0, 100000) || !s.tiles || typeof s.tiles !== 'object' || Array.isArray(s.tiles)) throw new Error('This is not a compatible Factory Shift save.');
      if (s.expansion === undefined) s.expansion = 0;
      if (!Number.isInteger(s.expansion) || !finite(s.expansion, 0, MAX_LAND)) throw new Error('Invalid expansion.');
      const height = H + s.expansion * 4;
      if (s.contentVersion === undefined) {
        s.deposits = Object.fromEntries(Object.entries(DEPOSITS).filter(([k])=>Number(k.split(',')[1])<height));
        s.rng = 230781; s.contentVersion = 3;
      }
      if (s.contentVersion===3) { s.lands=World.legacy(s.expansion);s.side={round:0,completed:0,offers:[],active:null,stage:-1};s.contentVersion=4; }
      if(s.contentVersion===4){s.contentVersion=5;s.startLayout='legacy';}
      if(s.contentVersion===5)s.contentVersion=6;
      if(s.contentVersion===6)s.contentVersion=7;
      if(s.contentVersion===7)s.contentVersion=8;
      const world=World.validate(s.lands,s.expansion);
      const inside=(x,y)=>x>=world.minX&&x<world.maxX&&y>=0&&y<world.maxY;
      if (s.contentVersion !== 8 || !Number.isInteger(s.rng) || !finite(s.rng,0,4294967295) || !s.deposits || Array.isArray(s.deposits) || typeof s.deposits!=='object') throw new Error('Invalid geology.');
      for(const [k,ore] of Object.entries(s.deposits)) {
        const [x,y]=k.split(',').map(Number);
        if(!Number.isInteger(x)||!Number.isInteger(y)||k!==key(x,y)||!inside(x,y)||world.blocked.has(k)||world.docks.has(k)||!Object.hasOwn(ORES,ore)) throw new Error('Invalid deposit.');
      }
      const initial=Object.entries(s.deposits).filter(([k])=>{const [x,y]=k.split(',').map(Number);return x>=0&&x<W&&y>=0&&y<H;});
      if(s.startLayout==='legacy'){
        if(initial.length!==4)throw Error('Invalid starter geology.');
        for(const [k,ore]of Object.entries(DEPOSITS))if(Number(k.split(',')[1])<H&&s.deposits[k]!==ore)throw Error('Invalid starter deposit.');
      }else if(s.startLayout!=='random'||initial.length!==6||s.deposits['1,2']!=='ore'||initial.filter(([,ore])=>ore==='ore').length<2||initial.filter(([,ore])=>ore==='copperOre').length<2)throw Error('Invalid starter geology.');
      for(const land of s.lands){const n=Object.keys(s.deposits).filter(k=>World.contains(land,...k.split(',').map(Number))).length;const d=World.TYPES[land.type];if(land.oreCount!==undefined&&land.oreCount!==World.oreCount(land))throw Error('Invalid land density.');if(land.type==='legacy'?(n<2||n>3):n!==(land.oreCount??d.ores))throw Error('Invalid land deposits.');}
      const side=s.side;
      if(!side||!Number.isInteger(side.round)||!finite(side.round,0,1e7)||!Number.isInteger(side.completed)||!finite(side.completed,0,1e7)||!Number.isInteger(side.stage)||side.stage< -1||side.stage>s.stage||!Array.isArray(side.offers)||![0,3].includes(side.offers.length))throw Error('Invalid order board.');
      for(const o of [...side.offers,...(side.active?[side.active]:[])]){
        if(!o||typeof o.id!=='string'||!/^\d+-\d+-[012]$/.test(o.id)||!['Workshop request','Bulk supply','Mixed shipment'].includes(o.title)||!Number.isInteger(o.reward)||!finite(o.reward,1,1e9)||!o.need||typeof o.need!=='object'||Array.isArray(o.need)||Object.keys(o.need).length<1||Object.keys(o.need).length>2||!o.progress||typeof o.progress!=='object'||Array.isArray(o.progress))throw Error('Invalid side order.');
        for(const [k,n]of Object.entries(o.need))if(!Object.hasOwn(RECIPES,k)||!Number.isInteger(n)||!finite(n,1,1e7))throw Error('Invalid side order target.');
        for(const [k,n]of Object.entries(o.progress))if(!Object.hasOwn(o.need,k)||!Number.isInteger(n)||!finite(n,0,o.need[k]))throw Error('Invalid side order progress.');
      }

      for (const p of ['elapsed', 'time', 'totalShipped', 'totalEarned', 'totalMade', 'medals']) if (!finite(s[p])) throw new Error('Invalid save statistics.');
      for (const p of ['powerLevel', 'speedLevel', 'beltLevel']) if (!Number.isInteger(s[p]) || !finite(s[p], 0, MAX_RESEARCH)) throw new Error('Invalid upgrades.');
      if (!s.delivered || Array.isArray(s.delivered) || typeof s.delivered !== 'object') throw new Error('Invalid deliveries.');
      for (const [i, n] of Object.entries(s.delivered)) if (!Object.hasOwn(ITEMS, i) || !finite(n)) throw new Error('Invalid delivery.');
      if (Object.keys(s.tiles).length > (world.maxX-world.minX) * world.maxY) throw new Error('Invalid factory size.');
      for (const [k, t] of Object.entries(s.tiles)) {
        if (!Object.hasOwn(BUILD, t.type) || !Number.isInteger(t.x) || !Number.isInteger(t.y) || !inside(t.x,t.y) || k !== key(t.x, t.y) || world.blocked.has(k) || world.docks.has(k) || (t.type === 'drill' && !s.deposits[k]) || BUILD[t.type].unlock > s.stage) throw new Error('Invalid machine placement.');
        if (!Number.isInteger(t.dir) || !finite(t.dir, 0, 3) || !Number.isInteger(t.level) || !finite(t.level, 1, MAX_LEVEL) || !finite(t.paid) || !finite(t.progress) || !Object.hasOwn(RECIPES,t.recipe)) throw new Error('Invalid machine state.');
        if (['press','alloyFurnace'].includes(t.type) && (!BUILD[t.type].recipes.includes(t.recipe) || (RECIPES[t.recipe].unlock || 0)>s.stage)) throw new Error('Invalid selected recipe.');
        if (!t.input || typeof t.input !== 'object' || Array.isArray(t.input)) throw new Error('Invalid input buffer.');
        for (const [i, n] of Object.entries(t.input)) if (!Object.hasOwn(ITEMS, i) || !Number.isInteger(n) || !finite(n, 0, 4)) throw new Error('Invalid input buffer.');
        if (t.out && (!Object.hasOwn(ITEMS, t.out.kind) || !finite(t.out.age) || !Number.isInteger(t.out.from) || !finite(t.out.from, 0, 3))) throw new Error('Invalid conveyor item.');
        if (t.job && (!Object.hasOwn(ITEMS, t.job.out) || !finite(t.job.seconds, .1, 10))) throw new Error('Invalid production job.');
        t.turn = t.turn === 1 ? 1 : 0; t.blocked = false;
        if (typeof t.freeBase !== 'boolean') {
          let upgradesPaid = 0;
          for (let level = 1; level < t.level; level++) upgradesPaid += Math.round(BUILD[t.type].cost * .7 * level);
          t.freeBase = t.paid === upgradesPaid;
        }
      }
      if (s.spares === undefined) {
        // Upgrade v0.1 saves, including starter equipment that was previously discarded.
        s.spares = {};
        for (const [type, total] of Object.entries({ belt: 9, drill: 1, smelter: 1 })) s.spares[type] = Math.max(0, total - Object.values(s.tiles).filter(t => t.type === type && t.freeBase).length);
      }
      if (!s.spares || Array.isArray(s.spares) || typeof s.spares !== 'object') throw new Error('Invalid stored equipment.');
      for (const [type, n] of Object.entries(s.spares)) if (!Object.hasOwn(BUILD, type) || !Number.isInteger(n) || !finite(n, 0, (world.maxX-world.minX)*world.maxY)) throw new Error('Invalid stored equipment.');
      s.started = !!s.started; s.tutorial = !!s.tutorial; s.sound = s.sound !== false;
      s.offlineEligible = !!s.offlineEligible; s.savedAt = finite(s.savedAt, 0, 1e15) ? s.savedAt : 0;
      // Only known numeric/string fields are displayed; imported HTML is never rendered.
      s.records = Array.isArray(s.records) ? s.records.filter(r => Number.isInteger(r.stage) && finite(r.seconds) && finite(r.stars, 1, 3)).slice(-100).map(r => ({ stage: r.stage, seconds: r.seconds, stars: r.stars })) : [];
      return s;
    }
  }
  const api = { Simulation, fresh, tile, key, contract, W, H, DIR, ITEMS, BUILD, RECIPES, DEPOSITS, BLOCKED, DOCKS, VERSION, STEP, transport, ORES, CONTRACTS, MAX_LAND, MAX_LEVEL, MAX_RESEARCH, recipeText, World };
  root.FactorySim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
