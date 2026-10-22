/* All artwork is original vector drawing, generated at display resolution. */
(function (root) {
  'use strict';
  const F = root.FactorySim;
  const CELL = 64, PAD = 54;
  function rowName(y) { let out='';for(let n=y+1;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out; }
  function rounded(c, x, y, w, h, radius, color, stroke) {
    c.beginPath(); c.roundRect(x, y, w, h, radius); c.fillStyle = color; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
  }
  function line(c, points, color, width = 2) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function circle(c, x, y, r, color, stroke) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  function text(c, str, x, y, size, color, align = 'left', weight = 600) {
    c.font = `${weight} ${size}px Arial, sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y);
  }
  function gear(c, x, y, r, angle, color) {
    c.save(); c.translate(x, y); c.rotate(angle); c.beginPath();
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, rr = i % 5 < 3 ? r : r * .78; const xx = Math.cos(a) * rr, yy = Math.sin(a) * rr; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
    c.closePath(); c.fillStyle = color; c.fill(); c.strokeStyle = '#183237'; c.lineWidth = 2; c.stroke(); circle(c, 0, 0, r * .32, '#24474c'); c.restore();
  }
  function arrow(c, dir, color, x = 32, y = 32, r = 6) {
    c.save(); c.translate(x, y); c.rotate(dir * Math.PI / 2); c.beginPath(); c.moveTo(-r / 2, -r); c.lineTo(r / 2 + 2, 0); c.lineTo(-r / 2, r); c.strokeStyle = color; c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.restore();
  }
  function item(c, kind, x, y, scale = 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    const col = F.ITEMS[kind]?.color || '#fff';
    if (F.ORES[kind]) {
      c.beginPath(); [[-8, 3], [-5, -6], [3, -9], [9, -1], [6, 7], [-2, 9]].forEach(([xx, yy], i) => i ? c.lineTo(xx, yy) : c.moveTo(xx, yy)); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = '#142c31'; c.lineWidth = 2; c.stroke(); line(c, [[-5, -4], [2, -6], [6, -1]], '#fff8', 2);
    } else if (kind === 'rod') { rounded(c,-13,-3,26,6,2,col,'#19353a'); line(c,[[-10,-2],[10,-2]],'#e9f9ed',1); }
    else if (kind === 'casing') { rounded(c,-10,-9,20,18,4,col,'#19353a'); rounded(c,-6,-5,12,10,2,'#415858'); }
    else if (kind === 'circuit') { rounded(c,-11,-9,22,18,2,col,'#19353a'); rounded(c,-4,-4,8,8,1,'#264849'); for(let i=-6;i<=6;i+=4)line(c,[[i,-8],[i,8]],'#e4cf83',1); }
    else if (kind === 'robot') { rounded(c,-8,-10,16,12,4,col,'#19353a'); circle(c,-3,-5,2,'#354c55');circle(c,3,-5,2,'#354c55');rounded(c,-10,3,20,8,3,col,'#19353a'); }
    else if (kind === 'gear') gear(c, 0, 0, 10, 0, col);
    else if (kind === 'wire') {
      rounded(c, -10, -8, 20, 16, 4, '#a96a3c', '#152e33');
      for (let i = -6; i < 8; i += 3) { c.beginPath(); c.ellipse(i, 0, 3, 7, 0, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); }
    } else if (kind === 'motor') {
      rounded(c, -10, -8, 20, 16, 4, col, '#152e33'); line(c, [[-14, 0], [-10, 0]], '#c8e1e1', 4); line(c, [[10, 0], [14, 0]], '#c8e1e1', 4); for (let i = -5; i < 6; i += 4) line(c, [[i, -5], [i, 5]], '#8078b0', 2);
    } else if (['battery','solder','radiator','sensor','controller','turbine','drone','watch','jewelry','engine','satellite','core','contact','coil','tube','beam','foil'].includes(kind)) {
      if (['drone','satellite'].includes(kind)) { line(c,[[-14,-8],[14,8]],col,4);line(c,[[-14,8],[14,-8]],col,4);for(const xx of [-12,12])circle(c,xx,0,5,'#6e9da0',col); }
      rounded(c,-9,-8,18,16,kind==='watch'||kind==='jewelry'?8:3,col,'#16363a');
      const marks={battery:'+',solder:'Sn',radiator:'≡',sensor:'•',controller:'IC',turbine:'T',drone:'D',watch:'◷',jewelry:'◇',engine:'E',satellite:'S',core:'Q',contact:'Au',coil:'Ag',tube:'U',beam:'H',foil:'Al'};
      text(c,marks[kind],0,0,8,'#284448','center',800);
    } else {
      rounded(c, -11, -6, 22, 14, 3, '#1c3439'); rounded(c, -11, -9, 22, 12, 3, col, '#19353a'); line(c, [[-7, -6], [7, -6]], '#fff9', 2);
      if (kind === 'plate') { line(c, [[-6, -3], [6, -3]], '#51828b', 2); line(c, [[-6, 0], [6, 0]], '#51828b', 2); }
    }
    c.restore();
  }
  function machine(c, t, time = 0, active = true, icon = false) {
    const kind = t.type, col = F.BUILD[kind].color;
    if (kind === 'belt' || kind === 'fastbelt') {
      c.save(); c.translate(32, 32); c.rotate(t.dir * Math.PI / 2); c.translate(-32, -32);
      rounded(c, -1, 13, 66, 41, 5, '#112d32'); rounded(c, -1, 10, 66, 40, 4, '#617476', '#17383d');
      rounded(c, 0, 15, 64, 30, 2, '#283f43');
      for (let i = -1; i < 6; i++) { const x = i * 16 + (time * (active ? 22 : 0) % 16); if (x > 0 && x < 64) line(c, [[x, 17], [x, 43]], '#4a6061', 2); }
      line(c, [[0, 12], [64, 12]], '#a7b2a8', 2); line(c, [[0, 48], [64, 48]], '#81958d', 2);
      arrow(c, 0, kind === 'fastbelt' ? '#7ff4ed' : '#8ca8a0', 32, 30, 5); if (kind === 'fastbelt') arrow(c, 0, '#7ff4ed', 46, 30, 5); c.restore();
      return;
    }
    if (kind === 'splitter') {
      rounded(c, 7, 12, 50, 49, 9, '#132e33'); rounded(c, 7, 6, 50, 48, 8, col, '#17343a'); rounded(c, 12, 11, 40, 36, 5, '#2a4a48');
      c.save(); c.translate(32, 29); c.rotate(t.dir * Math.PI / 2); line(c, [[-20, 0], [0, 0], [0, -20]], '#a2c59a', 6); line(c, [[0, 0], [0, 20]], '#a2c59a', 6); arrow(c, 3, '#153d36', 0, -11, 4); arrow(c, 1, '#153d36', 0, 11, 4); c.restore(); circle(c, 32, 29, 4, '#e7d496');
      return;
    }
    rounded(c, 7, 14, 50, 48, 7, '#112c31'); rounded(c, 5, 10, 54, 46, 5, '#527273', '#123238');
    rounded(c, 7, 5, 50, 44, 6, col, '#18363a');
    line(c, [[13, 8], [50, 8]], '#fff6', 2);
    for (const x of [11, 53]) for (const y of [12, 43]) { circle(c, x, y, 2, '#223e40'); line(c, [[x - 1, y], [x + 1, y]], '#afc2b1', 1); }
    const spin = active && t.job ? time : 0;
    if (kind === 'drill') {
      rounded(c, 16, 13, 32, 27, 4, '#6c673f', '#294346'); circle(c, 32, 26, 13, '#273e3d', '#c0a95c');
      gear(c, 32, 26, 10, spin * 2, '#f5d87a'); circle(c, 32, 26, 4, '#e1ead1');
      rounded(c, 21, 43, 22, 6, 2, '#283f3c');
      for (let i = 0; i < 3; i++) line(c, [[25 + i * 6, 44], [23 + i * 6, 48]], '#e3c66f', 2);
    } else if (kind === 'smelter') {
      rounded(c, 18, 13, 28, 28, 7, '#6d4941', '#9d614f'); rounded(c, 22, 18, 20, 18, 5, '#332e2e');
      if (spin) {
        circle(c, 32, 28, 9, '#ef8a42'); circle(c, 31 + Math.sin(time * 8) * 2, 27, 5, '#ffdc80');
        c.save(); c.globalAlpha = .18; circle(c, 32, 27, 18, '#ffa65e'); c.restore();
      } else line(c, [[25, 31], [39, 31]], '#e6a66e', 4);
      rounded(c, 43, -1, 10, 16, 3, '#b3b8a2', '#344f4e'); rounded(c, 41, -3, 14, 6, 2, '#63807b');
      if (spin && !icon) for (let i = 0; i < 3; i++) { const a = (time * .6 + i / 3) % 1; c.save(); c.globalAlpha = .24 * (1 - a); circle(c, 48 + Math.sin(a * 4) * 6, -6 - a * 27, 4 + a * 7, '#d5dfd0'); c.restore(); }
    } else if (kind === 'press') {
      rounded(c, 16, 17, 32, 24, 3, '#34676a'); rounded(c, 18, 30, 28, 7, 2, '#1a4448');
      const y = spin ? 15 + (Math.sin(time * 3) * .5 + .5) * 8 : 17;
      line(c, [[21, 13], [21, 37]], '#e6dfbf', 4); line(c, [[43, 13], [43, 37]], '#e6dfbf', 4); rounded(c, 16, y, 32, 8, 2, '#c6d8c8', '#2e585b');
      if (t.recipe === 'gear') gear(c, 32, 37, 6, 0, '#e2d8b3'); else rounded(c, 25, 33, 14, 4, 1, '#cde5e0');
    } else if (kind === 'wiremill') {
      rounded(c, 14, 17, 36, 24, 5, '#936b43');
      for (const x of [23, 41]) { circle(c, x, 28, 10, '#6d5741', '#f4d3a1'); circle(c, x, 28, 6, '#f8cc8b'); line(c, [[x - Math.cos(spin * 3) * 5, 28 - Math.sin(spin * 3) * 5], [x + Math.cos(spin * 3) * 5, 28 + Math.sin(spin * 3) * 5]], '#aa7746', 2); }
      line(c, [[22, 38], [42, 38]], '#f5d7a5', 3);
    } else if (kind === 'assembler') {
      rounded(c, 14, 13, 36, 29, 5, '#665e89'); rounded(c, 22, 22, 20, 16, 3, '#272e4c');
      const d = spin ? Math.sin(time * 3) * 4 : 0;
      line(c, [[15, 18], [23 + d, 23], [30, 32]], '#e3d4f0', 5); circle(c, 23 + d, 23, 4, '#9b86bc', '#eee0f3');
      line(c, [[49, 17], [43 - d, 23], [36, 31]], '#e3d4f0', 5); circle(c, 43 - d, 23, 4, '#9b86bc', '#eee0f3');
    }
    if (['cutter', 'polisher', 'electronics', 'fabricator'].includes(kind)) {
      rounded(c, 15, 15, 34, 27, 4, '#24464b');
      if (kind === 'cutter') { gear(c, 32, 26, 12, spin * 4, '#dbebdf'); line(c, [[16, 38], [48, 38]], '#7eb3ce', 4); }
      if (kind === 'polisher') { rounded(c, 23, 26, 18, 12, 3, '#ddbb92'); line(c, [[18, 19], [46, 19 + Math.sin(spin * 4) * 4]], '#f5dfbb', 5); }
      if (kind === 'electronics') { rounded(c, 21, 20, 22, 17, 2, '#83cc9c'); for (let i=0;i<3;i++) line(c, [[24,24+i*4],[39,24+i*4]], '#234d46', 2); }
      if (kind === 'fabricator') { circle(c, 32, 25, 9, '#e0d7f0'); circle(c, 29, 24, 2, '#486365'); circle(c, 35, 24, 2, '#486365'); line(c, [[21,39],[24,32],[40,32],[44,39]], '#d3b9ec', 4); }
    }
    if (F.BUILD[kind].glyph !== undefined) {
      const def=F.BUILD[kind], output=F.ITEMS[t.recipe] ? t.recipe : def.recipes[0];
      rounded(c,14,13,36,30,4,'#29494c');
      if(kind.endsWith('Refinery')) {
        rounded(c,20,16,24,25,7,'#547076');circle(c,32,29,9,spin?'#efa56c':def.color,'#193c40');
        text(c,F.ORES[def.recipes[0]+'Ore']?.symbol||'',32,29,9,'#263f43','center',800);
        line(c,[[45,13],[49,7],[49,0]],'#d1d9bd',4);
      } else if(kind==='alloyFurnace') {
        line(c,[[16,16],[24,24]],'#d6b874',5);line(c,[[48,16],[40,24]],'#c2d3de',5);
        rounded(c,20,24,24,17,5,spin?'#eab37a':'#a99068'); text(c,'+',32,30,13,'#384f4c','center');
      } else if(def.group==='production') {
        gear(c,22,24,8,spin*2,'#dce7d0');gear(c,42,24,8,-spin*2,'#c8d6c7');
        item(c,output,32,35,.65);
      } else {
        const offset=Math.sin(spin*3)*3;
        line(c,[[15,19],[22,25+offset],[24,35]],'#d5dbcb',3);line(c,[[49,19],[43,25-offset],[40,35]],'#d5dbcb',3);
        item(c,output,32,28,.85);circle(c,18,40,2,spin?'#dcf5a5':'#6e8f80');
      }
    }
    // Fixed side lights and a directional output socket.
    circle(c, 13, 48, 2.4, t.blocked ? '#f58b72' : t.job ? '#cbeb9b' : '#617873');
    c.save(); c.translate(32, 32); c.rotate(t.dir * Math.PI / 2); rounded(c, 24, -8, 8, 16, 2, '#182f34', '#8fa9a0'); arrow(c, 0, '#e9dba9', 27, 0, 3.5); c.restore();
    if (t.level > 1) { rounded(c, 7, 1, 15, 13, 3, '#eee3c4'); text(c, `${t.level-1}`, 14.5, 7, 9, '#234047', 'center', 800); }
    if (t.job) { rounded(c, 14, 53, 36, 3, 1, '#1a363a'); rounded(c, 14, 53, Math.max(1, 36 * Math.min(1, t.progress / t.job.seconds)), 3, 1, '#c6d9a8'); }
  }
  function connectedBelt(c, t, tiles, time, active) {
    const incoming = [];
    for (let side = 0; side < 4; side++) {
      if (side === t.dir) continue;
      const neighbor = tiles[F.key(t.x + F.DIR[side][0], t.y + F.DIR[side][1])];
      if (!neighbor) continue;
      const toward = (side + 2) % 4;
      if (neighbor.type === 'splitter' ? [(neighbor.dir + 1) % 4, (neighbor.dir + 3) % 4].includes(toward) : neighbor.dir === toward) incoming.push(side);
    }
    if (!incoming.length) incoming.push((t.dir + 2) % 4);
    const drawPath = side => {
      c.beginPath(); c.moveTo(32 + F.DIR[side][0] * 33, 32 + F.DIR[side][1] * 33);
      c.lineTo(32 + F.DIR[side][0] * 14, 32 + F.DIR[side][1] * 14);
      c.quadraticCurveTo(32, 32, 32 + F.DIR[t.dir][0] * 14, 32 + F.DIR[t.dir][1] * 14);
      c.lineTo(32 + F.DIR[t.dir][0] * 33, 32 + F.DIR[t.dir][1] * 33);
    };
    c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
    for (const [width, color] of [[44, '#142f34'], [39, t.type==='fastbelt'?'#59b8bf':'#82958b'], [33, '#2b4347']]) for (const side of incoming) { drawPath(side); c.lineWidth = width; c.strokeStyle = color; c.stroke(); }
    c.setLineDash([2, 12]); c.lineDashOffset = -(active ? time * 22 : 0);
    for (const side of incoming) { drawPath(side); c.lineWidth = 28; c.strokeStyle = '#4b6361'; c.stroke(); }
    c.setLineDash([]);
    if(t.type==='fastbelt') {
      // Permanent double chevron stays visible while paused and on corners.
      for(const offset of [3,17]) arrow(c,t.dir,'#7ff4ed',32+F.DIR[t.dir][0]*offset,32+F.DIR[t.dir][1]*offset,6);
    } else arrow(c, t.dir, '#96afa1', 32 + F.DIR[t.dir][0] * 8, 32 + F.DIR[t.dir][1] * 8, 5);
    c.restore();
  }
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.c = canvas.getContext('2d', { alpha: false }); this.rows = F.H; this.cols = F.W; this.minX = 0; this.maxX = F.W; this.zoom = 1; this.panX = 0; this.panY = 0; this.width = 800; this.height = 600; this.dpr = 1; this.particles = []; this.hover = null; this.selected = null; this.tool = 'select'; this.dir = 0; this.anim = true; }
    syncWorld(sim) { if(this.rows!==sim.height || this.cols!==sim.width || this.minX!==sim.world.minX) { this.rows=sim.height; this.cols=sim.width; this.minX=sim.world.minX; this.maxX=sim.world.maxX; this.resize(this.width,this.height,this.dpr); } }
    resize(w, h, dpr = 1) {
      this.width = Math.max(1, w); this.height = Math.max(1, h); this.dpr = Math.min(2, dpr);
      this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
      this.base = Math.min(this.width / (this.cols * CELL + PAD * 2), this.height / (this.rows * CELL + PAD * 2));
      this.layout();
    }
    layout() {
      this.scale = this.base * this.zoom;
      const maxX = Math.max(0, (this.cols * CELL * this.scale - this.width) / 2 + 60), maxY = Math.max(0, (this.rows * CELL * this.scale - this.height) / 2 + 60);
      this.panX = Math.max(-maxX, Math.min(maxX, this.panX)); this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
      this.ox = (this.width - this.cols * CELL * this.scale) / 2 + this.panX - this.minX * CELL * this.scale; this.oy = (this.height - this.rows * CELL * this.scale) / 2 + this.panY;
    }
    zoomBy(factor, x = this.width / 2, y = this.height / 2) {
      const wx = (x - this.ox) / this.scale, wy = (y - this.oy) / this.scale;
      this.zoom = Math.min(18, Math.max(1, this.zoom * factor)); this.layout();
      this.panX += x - (this.ox + wx * this.scale); this.panY += y - (this.oy + wy * this.scale); this.layout();
    }
    focusTile(x,y) { this.zoom=Math.min(18,Math.max(1,.7/this.base));this.panX=0;this.panY=0;this.layout();this.panX=this.width/2-(this.ox+(x+.5)*CELL*this.scale);this.panY=this.height/2-(this.oy+(y+.5)*CELL*this.scale);this.layout(); }
    fit() { this.zoom = 1; this.panX = 0; this.panY = 0; this.layout(); }
    cellAt(x, y) { return { x: Math.floor((x - this.ox) / this.scale / CELL), y: Math.floor((y - this.oy) / this.scale / CELL) }; }
    burst(x, y, color, label = '') {
      if (this.particles.length > 120) this.particles.splice(0, 20);
      for (let i = 0; i < (label ? 12 : 7); i++) this.particles.push({ x: x * CELL + 32, y: y * CELL + 25, vx: Math.cos(i) * 25, vy: Math.sin(i) * 25 - 25, life: 1, color, coin: !!label });
      if (label) this.particles.push({ x: x * CELL + 30, y: y * CELL, vx: 0, vy: -20, life: 1.5, color, label });
    }
    render(sim, time, dt = .016) {
      const c = this.c, s = sim.s;
      this.syncWorld(sim);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#163237'; c.fillRect(0, 0, this.width, this.height);
      const bg = c.createRadialGradient(this.width * .55, this.height * .4, 0, this.width * .5, this.height * .5, this.width * .75); bg.addColorStop(0, '#28484b'); bg.addColorStop(1, '#142d32'); c.fillStyle = bg; c.fillRect(0, 0, this.width, this.height);
      c.save(); c.translate(this.ox, this.oy); c.scale(this.scale, this.scale);
      const bw = this.cols * CELL, bh = this.rows * CELL, bx = this.minX * CELL;
      rounded(c, bx -15, -10, bw + 30, bh + 31, 15, '#102a2f'); rounded(c, bx -12, -14, bw + 24, bh + 27, 12, '#577170', '#0e292e'); rounded(c, bx -6, -8, bw + 12, bh + 15, 7, '#1a373b');
      for (let y = 0; y < this.rows; y++) for (let x = this.minX; x < this.maxX; x++) {
        const xx = x * CELL, yy = y * CELL;
        if(this.ox+(xx+CELL)*this.scale<0||this.ox+xx*this.scale>this.width||this.oy+(yy+CELL)*this.scale<0||this.oy+yy*this.scale>this.height)continue;
        rounded(c, xx + 1, yy + 1, CELL - 2, CELL - 2, 3, (x + y) % 2 ? '#2c4b4d' : '#2e4e50');
        if ((x * 3 + y * 7) % 5 === 0) { c.fillStyle = '#ffffff06'; c.fillRect(xx + 10, yy + 8, 23, 1); c.fillRect(xx + 43, yy + 47, 10, 1); }
        c.fillStyle = '#527070'; c.fillRect(xx + 3, yy + 3, 2, 2);
      }
      for (let x = this.minX; x < this.maxX; x++) { text(c, x<0?'L'+(-x):String(x + 1).padStart(2, '0'), x * CELL + 32, -27, 10, '#96aca2', 'center'); }
      for (let y = 0; y < this.rows; y++) text(c, rowName(y), bx -28, y * CELL + 32, 11, '#96aca2', 'center');
      text(c, 'PRODUCTION FLOOR / 01', bx+4, bh + 32, 11, '#8ca79f', 'left', 700); text(c, 'AUTOMATE SOMETHING GOOD.', bx+bw - 4, bh + 32, 10, '#829b92', 'right', 500);
      for (let x = bx+6; x < bx+bw - 8; x += 30) { line(c, [[x, -10], [x + 12, -10]], '#c9af66', 3); line(c, [[x, bh + 10], [x + 12, bh + 10]], '#c9af66', 3); }
      for(const l of s.lands) {
        const color=F.World.TYPES[l.type].color;
        c.fillStyle=color+'55';c.fillRect(l.x*CELL,l.y*CELL,l.w*CELL,l.h*CELL);
        c.save();c.setLineDash([9,7]);c.strokeStyle='#b9c8a544';c.lineWidth=2;c.strokeRect(l.x*CELL+2,l.y*CELL+2,l.w*CELL-4,l.h*CELL-4);c.restore();
        for(const k of l.blocks){const [x,y]=k.split(',').map(Number);rounded(c,x*CELL+7,y*CELL+8,50,48,8,'#444b48','#8b8774');rounded(c,x*CELL+14,y*CELL+16,21,18,4,'#8a8879');rounded(c,x*CELL+29,y*CELL+31,20,17,3,'#656f68');text(c,'RUBBLE',x*CELL+32,y*CELL+53,7,'#d1cab2','center');}
      }
      for (const [k, kind] of Object.entries(sim.deposits)) {
        const [x, y] = k.split(',').map(Number); if (y >= this.rows) continue; c.save(); c.translate(x * CELL, y * CELL);
        rounded(c, 4, 4, 56, 56, 10, '#385354', F.ORES[kind].color);
        for (let i = 0; i < 5; i++) item(c, kind, 14 + i % 3 * 16, 18 + Math.floor(i / 3) * 22, .65);
        if (!s.tiles[k]) text(c, F.ORES[kind].symbol, 45, 48, 12, '#f5e8c3', 'center', 800);
        c.restore();
      }
      // Structural utility island, with pipes and planted industrial greenery.
      rounded(c, 6 * CELL + 3, 4 * CELL + 8, CELL * 2 - 6, CELL * 2 - 2, 10, '#112f34');
      rounded(c, 6 * CELL + 4, 4 * CELL, CELL * 2 - 8, CELL * 2 - 8, 10, '#506a63', '#17393b');
      for (let i = 0; i < 5; i++) line(c, [[6 * CELL + 12 + i * 22, 4 * CELL + 4], [6 * CELL + 22 + i * 22, 4 * CELL + 4]], '#d9bc71', 3);
      rounded(c, 6 * CELL + 14, 4 * CELL + 14, 57, 87, 7, '#2b4949', '#73877a');
      for (let i = 0; i < 4; i++) rounded(c, 6 * CELL + 22, 4 * CELL + 22 + i * 17, 40, 7, 2, '#1e393d');
      rounded(c, 7 * CELL + 15, 4 * CELL + 22, 25, 65, 7, '#a2aaa0', '#294648');
      line(c, [[7 * CELL + 27, 4 * CELL + 10], [7 * CELL + 27, 4 * CELL + 23]], '#bfc1aa', 8);
      circle(c, 7 * CELL + 27, 4 * CELL + 43, 8, '#263e3e', '#d9c489'); line(c, [[7 * CELL + 27, 4 * CELL + 43], [7 * CELL + 31, 4 * CELL + 38]], '#e6dba5', 2);
      text(c, 'UTILITIES', 7 * CELL, 6 * CELL - 18, 9, '#c8d1b5', 'center');
      for (const k of sim.docks) {
        const [x, y] = k.split(',').map(Number); if (y >= this.rows) continue; c.save(); c.translate(x * CELL, y * CELL);
        rounded(c, 1, 3, 62, 59, 5, '#193c3b', '#8eb99c'); rounded(c, 5, 6, 54, 47, 4, '#76a38c'); rounded(c, 10, 10, 45, 35, 3, '#284b44');
        const parcel=s.lands.find(l=>l.dock===k),dockDir=parcel?.direction==='left'?2:parcel?.direction==='down'?1:0;
        for (let i = 0; i < 3; i++) arrow(c, dockDir, '#b6d1a5', 19 + i * 12, 27, 6);
        text(c, 'SHIP', 32, 54, 8, '#d5e6be', 'center', 800); c.restore();
      }
      for (const t of Object.values(s.tiles)) { c.save(); c.translate(t.x * CELL, t.y * CELL); if (t.type === 'belt' || t.type === 'fastbelt') connectedBelt(c, t, s.tiles, time, this.anim); else machine(c, t, time, this.anim); c.restore(); }
      for (const t of Object.values(s.tiles)) if (t.out) {
        let x = t.x * CELL + 32, y = t.y * CELL + 29;
        if (F.transport(t)) {
          const f = Math.min(1, t.out.age / (sim.travel(t)));
          if (f < .5) { x -= F.DIR[t.out.from][0] * (1 - f * 2) * 28; y -= F.DIR[t.out.from][1] * (1 - f * 2) * 28; }
          else { const d = t.type === 'splitter' ? (t.dir + (t.turn ? 3 : 1)) % 4 : t.dir; x += F.DIR[d][0] * (f * 2 - 1) * 24; y += F.DIR[d][1] * (f * 2 - 1) * 24; }
          item(c, t.out.kind, x, y, .85);
        } else item(c, t.out.kind, x, t.y * CELL + 22, .65);
        if (t.blocked) { circle(c, t.x * CELL + 54, t.y * CELL + 9, 5, '#e78a70', '#17373d'); text(c, '!', t.x * CELL + 54, t.y * CELL + 9.5, 8, '#4b302e', 'center', 800); }
      }
      if (s.tutorial) {
        let target = null, label = '';
        if (s.stage === 0 && !s.tiles['4,2']) { target = [4, 2]; label = 'CONNECT HERE'; }
        else if (s.stage === 1 && !Object.values(s.tiles).some(t => t.type === 'press')) { target = [6, 2]; label = 'ADD A PRESS'; }
        else if (s.stage === 3 && !Object.values(s.tiles).some(t => t.type === 'wiremill')) { target = Object.entries(sim.deposits).find(([,kind])=>kind==='copperOre')[0].split(',').map(Number); label = 'COPPER STARTS HERE'; }
        if (target) {
          const [x, y] = target; c.save(); c.globalAlpha = .75 + Math.sin(time * 3) * .2; rounded(c, x * CELL + 3, y * CELL + 3, 58, 58, 6, '#edc57524', '#efc874'); c.restore();
          rounded(c, x * CELL - 31, y * CELL - 30, 126, 23, 4, '#f3d18a'); text(c, label, x * CELL + 32, y * CELL - 18, 9, '#3a4540', 'center', 800); arrow(c, 1, '#f3d18a', x * CELL + 32, y * CELL - 3, 4);
        }
      }
      if (this.selected) { const { x, y } = this.selected; c.save(); c.setLineDash([7, 4]); rounded(c, x * CELL, y * CELL, CELL, CELL, 6, '#ffffff09', '#fff1ba'); c.restore(); }
      if (this.hover && this.tool !== 'pan') {
        const { x, y } = this.hover;
        if (sim.inside(x,y)) {
          const valid = F.BUILD[this.tool] ? !sim.allowed(this.tool, x, y) || (this.tool === 'belt' && s.tiles[F.key(x, y)]?.type === 'belt') : true;
          c.save(); c.globalAlpha = .6;
          if (F.BUILD[this.tool]) { c.translate(x * CELL, y * CELL); machine(c, F.tile(this.tool, x, y, this.dir), time, false); c.translate(-x * CELL, -y * CELL); }
          rounded(c, x * CELL + 1, y * CELL + 1, 62, 62, 5, this.tool === 'erase' ? '#dc7e6655' : '#f0d49d16', valid ? '#e5d9af' : '#fa917c'); c.restore();
        }
      }
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; c.save(); c.globalAlpha = Math.max(0, Math.min(1, p.life)); if (p.label) text(c, p.label, p.x, p.y, 24, p.color, 'center', 800); else if (p.coin) { circle(c, p.x, p.y, 6, '#f3ce75', '#a27a35'); text(c, 'C', p.x, p.y, 7, '#715324', 'center'); } else rounded(c, p.x, p.y, 4, 4, 1, p.color); c.restore(); }
      this.particles = this.particles.filter(p => p.life > 0); c.restore();
    }
  }
  root.FactoryArt = { Renderer, machine, item, rounded, text, CELL, PAD, rowName };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FactoryArt;
})(typeof globalThis !== 'undefined' ? globalThis : this);
