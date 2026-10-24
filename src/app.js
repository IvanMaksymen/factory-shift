(function () {
  'use strict';
  const F = FactorySim, A = FactoryArt, $ = id => document.getElementById(id);
  let landDirection='down', landType='industrial';
  const colName=x=>x<0?'L'+(-x):String(x+1);
  const money = n => Math.floor(n).toLocaleString('en-US');
  const clock = n => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const renderer = new A.Renderer($('factoryCanvas'));
  const platform = new FactoryPlatform();
  let sim = new F.Simulation(), tool = 'belt', direction = 0, selected = null, manualPaused = false, menu = '', speed = 1, loaded = false, savedState = false, carriedOffline = null, startMessage = '', saveBlocked = false;
  let lastFrame = 0, accumulator = 0, uiClock = 0, saveClock = 0, toastTimer, inspectKey = '', priorStage = -1, lastPlaying = false, hiddenSince = 0, hiddenEligible = false, lastFocus = null, stockKey = '', category = 'all';
  let selection = [], moving = false, moveAnchor = null, pendingRecycle = [], lastWheelTurn = -Infinity;
  const selecting = () => tool === 'select' || tool === 'multi';
  const sounds = {
    context: null, lastShip: 0,
    unlock() {
      if (!sim.s.sound) return;
      try { const Audio = window.AudioContext || window.webkitAudioContext; if (!this.context && Audio) this.context = new Audio(); if (this.context && this.context.state !== 'running') this.context.resume().catch(() => {}); } catch (_) {}
    },
    tone(freq = 520, duration = .07, delay = 0, type = 'sine') {
      if (!sim.s.sound || !this.context || this.context.state !== 'running' || document.hidden) return;
      const c = this.context, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * .75, t + duration);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .006); g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + duration + .02);
    },
    ship() { const now = performance.now(); if (now - this.lastShip > 800) { this.tone(780, .055); this.lastShip = now; } },
    win() { [440, 554, 660, 880].forEach((f, i) => this.tone(f, .2, i * .09)); }
  };
  function playing() { return loaded && sim.s.started && !manualPaused && !menu && !document.hidden; }
  function syncPlaying() { const active = playing(); platform.setPlaying(active); renderer.anim = active; if (!active) accumulator = 0; lastPlaying = active; }
  function toast(message, duration = 3200) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), duration); }
  function save(quiet = true) {
    if (!loaded || saveBlocked) return;
    sim.s.savedAt = Date.now(); sim.s.offlineEligible = sim.s.started && !manualPaused && (!menu || menu === 'intro');
    const ok = platform.save(sim.serialize());
    $('saveStatus').textContent = ok ? (platform.sdk ? 'Progress saved' : 'Saved on this device') : 'Saving blocked · export in Settings';
    $('saveDot').style.background = ok ? '#72936c' : '#bf8153';
    if (!quiet) toast(ok ? 'Progress saved.' : 'Storage unavailable. Use Settings → Export save.', 5000);
  }
  function paintIcons(root = document) {
    root.querySelectorAll('canvas[data-machine],canvas[data-item]').forEach(canvas => {
      const c = canvas.getContext('2d'), sz = canvas.dataset.machine ? 64 : 36;
      canvas.width = sz * 2; canvas.height = sz * 2; c.scale(2, 2);
      if (canvas.dataset.machine) A.machine(c, { ...F.tile(canvas.dataset.machine, 0, 0), recipe: canvas.dataset.recipe || F.BUILD[canvas.dataset.machine].recipes[0] || 'plate' }, 0, false, true);
      else A.item(c, canvas.dataset.item, 18, 18, 1);
    });
  }
  function hideActions() { $('selectionMenu').hidden = true; }
  function setSelection(cells) {
    selection = sim.selection(cells).map(t => ({x:t.x,y:t.y}));
    selected = selection[0] || null; renderer.selected = selected; renderer.selection = selection;
    inspectKey = ''; if (!selected) $('inspector').hidden = true;
    hideActions();
  }
  function cancelMove() { moving=false; moveAnchor=null; renderer.movePreview=null; $('moveHint').hidden=true; }
  function clearSelection() { cancelMove(); setSelection([]); renderer.selectionRect=null; }
  function startMove() {
    if (!selection.length) return;
    moving=true; moveAnchor={...selection[0]}; hideActions(); $('inspector').hidden=true;
    $('moveHint').hidden=false; previewMove(moveAnchor);
    toast('Tap a destination for the highlighted anchor, or drag the selection.');
  }
  function previewMove(cell) {
    if (!moveAnchor) return;
    const dx=cell.x-moveAnchor.x, dy=cell.y-moveAnchor.y;
    renderer.movePreview={cells:selection, anchor:moveAnchor, dx, dy, error:sim.moveError(selection,dx,dy)};
    $('moveMessage').textContent=renderer.movePreview.error || 'Release / tap to place · highlighted tile is the anchor';
  }
  function finishMove(cell) {
    if (!moveAnchor) return;
    const dx=cell.x-moveAnchor.x, dy=cell.y-moveAnchor.y, error=sim.move(selection,dx,dy);
    if (error) { toast(error); cancelMove(); showInspector(true); return; }
    const next=selection.map(p=>({x:p.x+dx,y:p.y+dy})); cancelMove(); setSelection(next);
    updateUI(); save();
  }
  function recyclePrompt(cells) {
    pendingRecycle=sim.selection(cells).map(t=>({x:t.x,y:t.y})); if (!pendingRecycle.length) return;
    const tiles=sim.selection(pendingRecycle), refund=tiles.reduce((n,t)=>n+t.paid,0), stored=tiles.filter(t=>t.freeBase).length;
    hideActions();
    openModal('recycle', header('RECYCLE EQUIPMENT?', `Recycle ${tiles.length} ${tiles.length===1?'object':'objects'}?`)+`<p>You will receive <b>${money(refund)} C</b>${stored?` and ${stored} starter ${stored===1?'machine':'machines'} back in storage`:''}. Materials inside this equipment will be discarded.</p><div class="modal-footer"><button class="secondary-button" data-action="closeModal">Cancel</button><button class="danger-button" data-action="confirmRecycle">Recycle ${tiles.length} · +${money(refund)} C</button></div>`);
  }
  function actionMenu(p) {
    if (!selection.length) return;
    const quote=sim.upgradeQuote(selection), box=$('selectionMenu');
    box.innerHTML=`<b>${selection.length} selected</b><button data-action="moveMachine">Move</button><button data-action="rotateMachine">Rotate outputs</button><button data-action="upgradeMachine" ${!quote.count||sim.s.coins<quote.cost?'disabled':''}>${quote.count?`Upgrade ${quote.count} · ${money(quote.cost)} C`:'All at max level'}</button><button class="danger" data-action="recycleMachine">Recycle…</button><button data-action="hideActions">Close</button>`;
    box.style.left=Math.max(8,Math.min(p.x,renderer.width-214))+'px'; box.style.top=Math.max(8,Math.min(p.y,renderer.height-260))+'px'; box.hidden=false; box.querySelectorAll('button')[0]?.focus();
  }
  const groups = Object.fromEntries(['logistics','production','metals','advanced'].map(group=>[group,Object.keys(F.BUILD).filter(k=>F.BUILD[k].group===group)]));
  function buildCards() {
    stockKey = JSON.stringify(sim.s.spares);
    document.querySelectorAll('[data-category]').forEach(b => { b.classList.toggle('active', b.dataset.category === category); b.setAttribute('aria-pressed', String(b.dataset.category === category)); });
    $('buildCards').innerHTML = Object.entries(F.BUILD).map(([type, def], i) => {
      if (category !== 'all' && !groups[category].includes(type)) return '';
      const lock = sim.s.stage < def.unlock, stock = sim.s.spares[type] || 0;
      return `<div class="build-entry"><button class="build-card ${lock ? 'locked' : ''} ${tool === type ? 'active' : ''}" data-tool="${type}" aria-label="${def.name}, ${lock ? `locked until shift ${def.unlock + 1}` : stock ? `${stock} stored, free to place` : `${def.cost} credits`}"><span class="hotkey">${lock ? '·' : i < 7 ? i + 1 : '+'}</span><canvas data-machine="${type}"></canvas><b>${def.name}</b><span class="cost">${lock ? `SHIFT ${String(def.unlock + 1).padStart(2, '0')}` : stock ? `${stock} STORED · FREE` : `${def.cost} C`}</span></button><button class="machine-info" data-action="machineInfo" data-type="${type}" aria-label="Guide: ${def.name}">i</button></div>`;
    }).join(''); paintIcons($('buildCards'));
    document.querySelectorAll('[data-tool]').forEach(b => { b.classList.toggle('active', b.dataset.tool === tool); b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); });
    const descriptions = { multi: '<b>Select group</b> · Tap to add / remove', select: '<b>Inspect</b> · Drag equipment to move', pan: '<b>Move view</b> · Drag the floor', erase: '<b>Recycle</b> · Refund / store starter kit' };
    $('toolDescription').innerHTML = descriptions[tool] || `<b>${F.BUILD[tool].name}</b> · ${(sim.s.spares[tool] || 0) > 0 ? 'Stored · free to place' : tool === 'belt' ? 'Drag a route' : sim.buildCost(tool) + ' C · Tap to place'}`;
  }
  function selectTool(next) {
    if (F.BUILD[next] && sim.s.stage < F.BUILD[next].unlock) { toast(`${F.BUILD[next].name} unlocks after shift ${F.BUILD[next].unlock}.`); return; }
    if (!['select', 'multi', 'erase', 'pan', ...Object.keys(F.BUILD)].includes(next)) return;
    if (F.BUILD[next] && category !== 'all' && !groups[category].includes(next)) category = 'all';
    cancelMove(); hideActions(); tool = next; renderer.tool = tool;
    if (!selecting()) clearSelection();
    $('factoryCanvas').style.cursor = next === 'pan' ? 'grab' : next === 'select' ? 'default' : 'crosshair';
    buildCards(); updateUI();
  }
  function rotate() {
    if (selecting() && selected) { sim.rotateMany(selection); showInspector(true); }
    else { direction = (direction + 1) % 4; renderer.dir = direction; $('directionArrow').textContent = ['→', '↓', '←', '↑'][direction]; }
    sounds.tone(370, .05); save();
  }
  function requirementsHTML() {
    return Object.entries(sim.order.need).map(([i, n]) => `<div class="requirement" data-requirement="${i}"><div class="requirement-top"><canvas class="item-icon" data-item="${i}"></canvas><div class="requirement-info"><b>${F.ITEMS[i].name}</b><span>Deliver to any dock</span></div><span class="requirement-amount" data-count="${i}">0 / ${n}</span></div><div class="progress-track"><div class="progress-fill" data-progress="${i}"></div></div></div>`).join('');
  }
  function refreshOrder() {
    priorStage = sim.s.stage; const c = sim.order;
    $('shiftLabel').textContent = `SHIFT ${String(sim.s.stage + 1).padStart(2, '0')}`;
    $('orderCount').textContent = sim.s.stage < F.CONTRACTS.length ? `${String(sim.s.stage + 1).padStart(2, '0')} / ${F.CONTRACTS.length}` : 'ENDLESS';
    $('client').textContent = c.client; $('orderTitle').textContent = c.title;
    $('orderLead').textContent = sim.s.stage === 0 ? 'A good shift starts with a connected line.' : c.modifier ? c.hint : 'All goods sell at full price. Open Orders for extra rewards.';
    $('requirements').innerHTML = requirementsHTML(); paintIcons($('requirements'));
    $('reward').textContent = `+${money(c.reward)} C`;
    $('mobileStage').textContent = `SHIFT ${String(sim.s.stage + 1).padStart(2, '0')} · +${money(c.reward)} C`;
    $('mobileTitle').textContent = c.title; buildCards();
    if (tool in F.BUILD && F.BUILD[tool].unlock > sim.s.stage) selectTool('belt');
  }
  function updateUI() {
    if (priorStage !== sim.s.stage) refreshOrder();
    if (stockKey !== JSON.stringify(sim.s.spares)) buildCards();
    $('ordersButton').textContent = sim.sideReady ? 'Orders · Claim!' : sim.s.side.active ? 'Orders · Active' : 'Orders';
    $('ordersButton').classList.toggle('order-ready',sim.sideReady);
    $('floorSize').textContent = `Expand · ${sim.width} × ${sim.height}`;
    $('recipeGuide').textContent = F.BUILD[tool] ? F.BUILD[tool].tip : tool === 'multi' ? 'Tap objects to add / remove. Desktop: drag a selection box. Use Actions for the whole group.' : tool === 'select' ? 'Drag equipment to move. Shift-click adds to selection. Wheel over selected equipment rotates.' : tool === 'erase' ? 'Tap or drag across equipment, then confirm recycling. Starter machines return to storage.' : 'Drag to move the floor. Pinch or use + / − to zoom.';
    $('coins').textContent = money(sim.s.coins);
    $('throughput').textContent = sim.rate; $('totalShips').textContent = money(sim.s.totalShipped); $('medals').textContent = sim.s.medals;
    $('clock').textContent = clock(sim.s.elapsed); $('target').textContent = sim.s.elapsed > sim.order.par ? (sim.s.elapsed > sim.order.par * 1.7 ? 'Complete at your own pace' : '2-star bonus still available') : `3 stars under ${clock(sim.order.par)}`;
    let count = 0, total = 0;
    for (const [i, n] of Object.entries(sim.order.need)) {
      const got = Math.min(n, sim.s.delivered[i] || 0); count += got; total += n;
      document.querySelectorAll(`[data-count="${i}"]`).forEach(el => { el.textContent = `${got} / ${n}`; });
      document.querySelectorAll(`[data-progress="${i}"]`).forEach(el => { el.style.width = `${got / n * 100}%`; });
      document.querySelectorAll(`[data-requirement="${i}"]`).forEach(el => el.classList.toggle('done', got >= n));
    }
    $('shipButton').disabled = !sim.ready; $('shipButton').classList.toggle('ready', sim.ready); $('shipButton').textContent = sim.ready ? 'Complete contract →' : 'Waiting for delivery';
    $('mobileProgress').textContent = sim.ready ? 'CLAIM →' : `${count} / ${total} →`; $('mobileContract').classList.toggle('ready', sim.ready);
    const modalClaim = $('modalClaim'); if (modalClaim) { modalClaim.disabled = !sim.ready; modalClaim.textContent = sim.ready ? 'Complete contract →' : 'Back to the floor'; modalClaim.disabled = false; }
    $('pauseButton').textContent = manualPaused ? '▶' : 'Ⅱ'; $('pauseButton').setAttribute('aria-label', manualPaused ? 'Resume' : 'Pause');
    $('pausedBanner').hidden = !manualPaused || !!menu; $('floorState').textContent = manualPaused || menu ? 'SHIFT ON HOLD' : 'LIVE PRODUCTION';
    $('undoButton').disabled = !sim.history.length;
    document.querySelectorAll('.build-card:not(.locked)').forEach(b => b.classList.toggle('unaffordable', sim.s.coins < sim.buildCost(b.dataset.tool)));
    const coach = $('coach'); coach.hidden = !sim.s.tutorial || !!selected;
    const tips = [
      ['One connection away.', sim.s.tiles['4,2'] ? 'The line is moving! Follow the ingots to the green shipping dock.' : 'Conveyor selected. Tap the glowing gap to start shipping.'],
      ['Give iron a new shape.', 'Select Press below, then place it over a belt after your smelter.'],
      ['A different kind of shift.', 'Inspect your Press and choose Gears. Same iron, a new product.'],
      ['Time for a second line.', 'Copper deposit → Extractor → Smelter → Wire mill → a green dock.'],
      ['Two lines. One rhythm.', 'Ship gears and wire together. Upgrade individual machines to clear bottlenecks.'],
      ['Make something greater.', 'Feed 2 gears + 2 wires into an Assembler from different sides.'],
      ['Divide and deliver.', 'Splitters alternate between their two side exits. Share iron between presses.'],
      ['Your factory, in harmony.', 'Supply the Assembler while shipping spare gears and wire.']
    ];
    const tip = sim.ready ? ['A shift well spent.', 'Your order is ready. Complete the contract on the dispatch board.'] : sim.s.stage < 8 ? tips[sim.s.stage] : ['Plan this production line.', sim.order.hint];
    $('nextAction').textContent = sim.ready ? 'Order ready — claim your reward!' : sim.order.hint;
    $('coachTitle').textContent = tip[0]; $('coachText').textContent = tip[1];
    if (selected && !moving) showInspector(); else $('inspector').hidden = true;
  }
  function inspectStatus(t) {
    if (t.blocked) return 'Output blocked. Check the next tile and its direction.';
    if (t.job) return `Producing ${F.ITEMS[t.job.out].name.toLowerCase()} · ${Math.round(t.progress / t.job.seconds * 100)}%`;
    if (t.out) return `Moving ${F.ITEMS[t.out.kind].name.toLowerCase()}`;
    if (t.type === 'belt') return 'Waiting for an item. Arrow shows the exit.';
    if (t.type === 'splitter') return 'Alternates between the two side exits.';
    return 'Waiting for input. Connect the correct material.';
  }
  function showInspector(force = false) {
    if (!selected || moving) return;
    if (selection.length > 1) {
      const quote=sim.upgradeQuote(selection), refund=sim.selection(selection).reduce((n,t)=>n+t.paid,0);
      const k='group:'+JSON.stringify(selection)+':'+quote.cost+':'+(sim.s.coins>=quote.cost);
      if (force || inspectKey!==k) {
        inspectKey=k; $('inspector').innerHTML=`<div class="inspect-header"><div><b>${selection.length} objects selected</b><small>Group actions · one Undo per edit</small></div><button class="close-inspect" data-action="closeInspector" aria-label="Clear selection">×</button></div><div class="inspect-row"><button data-action="moveMachine">Move group</button><button data-action="rotateMachine">Rotate outputs</button></div><div class="inspect-row"><button data-action="upgradeMachine" ${!quote.count||sim.s.coins<quote.cost?'disabled':''}>${quote.count?`Upgrade ${quote.count} · ${money(quote.cost)} C`:'All at max level'}</button></div><div class="inspect-row"><button data-action="selectionActions">Actions</button><button class="danger" data-action="recycleMachine">Recycle +${money(refund)} C</button></div>`; $('inspector').hidden=false;
      }
      return;
    }
    const t = sim.s.tiles[F.key(selected.x, selected.y)];
    if (!t) { clearSelection(); return; }
    const k = `${t.x},${t.y},${t.type},${t.dir},${t.recipe},${t.level},${sim.s.coins >= sim.upgradeCost(t)},${sim.s.stage}`;
    if (force || inspectKey !== k) {
      inspectKey = k; const def = F.BUILD[t.type], upgradeCost = sim.upgradeCost(t), atSpeedCap = sim.speedBonus(t,F.transport(t)) >= 2;
      $('inspector').innerHTML = `<div class="inspect-header"><canvas data-machine="${t.type}" data-recipe="${t.recipe}"></canvas><div><b>${def.name}</b><small>${A.rowName(t.y)}${colName(t.x)} · UPGRADE ${t.level-1}/${F.MAX_LEVEL-1} · ${Math.round((F.transport(t)?sim.speedBonus(t,true):sim.productionSpeed(t))*100)}% SPEED</small></div><button class="close-inspect" data-action="closeInspector" aria-label="Close inspector">×</button></div><div class="inspect-status" id="inspectStatus"></div><div class="inspect-buffer" id="inspectBuffer"></div>${['press','alloyFurnace'].includes(t.type) ? `<span class="inspect-label">CHOOSE RECIPE</span><div class="recipe-choices">${def.recipes.map(r=>`<button data-action="recipe" data-recipe="${r}" ${Math.max(r==='gear'?2:0,F.RECIPES[r].unlock||0)>sim.s.stage?'disabled':''} class="${r===t.recipe?'chosen':''}">${F.ITEMS[F.RECIPES[r].out].name}${(F.RECIPES[r].unlock||0)>sim.s.stage?' · Shift '+(F.RECIPES[r].unlock+1):''}</button>`).join('')}</div>` : ''}<div class="inspect-row"><button data-action="rotateMachine">Rotate ${['→', '↓', '←', '↑'][t.dir]}</button>${true ? `<button data-action="upgradeMachine" ${t.level >= F.MAX_LEVEL || atSpeedCap || sim.s.coins < upgradeCost ? 'disabled' : ''}>${t.level >= F.MAX_LEVEL ? 'Max level' : atSpeedCap ? 'Speed cap · 200%' : `+10% base · ${upgradeCost} C`}</button>` : ''}</div><div class="inspect-row"><button data-action="moveMachine">Move</button><button data-action="selectionActions">Actions</button></div><div class="inspect-row"><button data-action="copyMachine">Build another</button><button class="danger" data-action="recycleMachine">${t.freeBase ? 'Store' + (t.paid ? ' +' + t.paid + ' C' : ' for free') : 'Recycle +' + t.paid + ' C'}</button></div>`;
      paintIcons($('inspector')); $('inspector').hidden = false;
    }
    $('inspectStatus').textContent = inspectStatus(t);
    const inputs = Object.entries(t.input).filter(([, q]) => q > 0).map(([i, q]) => `${q} ${F.ITEMS[i].name.toLowerCase()}`);
    $('inspectBuffer').textContent = inputs.length ? `Buffer: ${inputs.join(', ')}` : F.BUILD[t.type].tip;
  }
  function openModal(name, html, extraClass = '') {
    cancelMove(); hideActions();
    if (!menu) lastFocus = document.activeElement; menu = name; $('modal').className = `modal ${extraClass}`; $('modal').innerHTML = html; $('modalBackdrop').hidden = false; paintIcons($('modal')); syncPlaying(); updateUI(); $('modal').focus();
  }
  $('modalBackdrop').addEventListener('click', e => {
    if (e.target === $('modalBackdrop') && ['machineGuide','recycle'].includes(menu)) closeModal();
  });
  function closeModal() { pendingRecycle=[]; menu = ''; $('modalBackdrop').hidden = true; syncPlaying(); updateUI(); if (lastFocus?.focus) lastFocus.focus(); save(); }
  function header(label, title) { return `<div class="modal-header"><div><span class="eyebrow">${label}</span><h2 id="modalTitle">${title}</h2></div><button class="modal-close" data-action="closeModal" aria-label="Close">×</button></div>`; }
  function intro() {
    const returning = sim.s.started;
    openModal('intro', `<span class="eyebrow">FACTORY SHIFT · A LITTLE INDUSTRIAL INGENUITY</span><h2 id="modalTitle">${returning ? 'Your next<br><em>great shift.</em>' : 'A small floor.<br><em>Big possibilities.</em>'}</h2><p>${returning ? `Shift ${sim.s.stage + 1} is waiting. Your factory is just as you left it.${carriedOffline?.coins > 0 ? ` It earned ${money(carriedOffline.coins)} credits while you were away.` : ''}` : 'Connect a line. Watch it come alive. Turn a humble workshop into a beautifully efficient factory.'}</p><div class="intro-flow"><div><canvas data-machine="drill"></canvas><b>EXTRACT</b></div><span>→</span><div><canvas data-machine="smelter"></canvas><b>TRANSFORM</b></div><span>→</span><div><canvas data-item="motor"></canvas><b>DELIVER</b></div></div><div class="save-reminder"><b>Before you close the game</b><p>Use Settings → Save now and check that saving succeeded. For a portable backup, use Export save.</p><small>${platform.storageAvailable ? 'Autosave runs every 10 seconds during play and after edits.' : 'Browser storage is unavailable. Export save before leaving to keep your progress.'}</small></div><button class="primary-button" data-action="start">${returning ? 'Continue your shift' : 'Start your shift'} <span>→</span></button><p class="intro-note">Mouse or touch · No rush · Every machine can be recycled</p>`, 'intro');
  }
  function upgrades() { landMenu(); }
  function landMenu() {
    const offer=sim.landOffer(landDirection,landType), def=F.World.TYPES[landType], max=sim.s.expansion>=F.MAX_LAND;
    const b=sim.world, left=Math.min(b.minX,offer.x), right=Math.max(b.maxX,offer.x+offer.w), bottom=Math.max(b.maxY,offer.y+offer.h);
    const map=`<svg class="land-map" viewBox="${left-2} -2 ${right-left+4} ${bottom+4}" role="img" aria-label="Current factory and proposed land"><rect x="${b.minX}" y="0" width="${sim.width}" height="${sim.height}" rx=".4" fill="#37595a"/><rect x="${offer.x}" y="${offer.y}" width="${offer.w}" height="${offer.h}" fill="#b5c779" stroke="#647b46" stroke-width=".2"/><text x="${(b.minX+b.maxX)/2}" y="${b.maxY/2}" text-anchor="middle" fill="#edf0d3" font-size="1.4">FACTORY</text></svg>`;
    openModal('land',header('ROOM TO GROW','Choose your next parcel.')+`<p>Buy a strip along one edge. Existing machines and docks stay in place. New parcels have no shipping docks. Route products back to the original docks on the right. LAND ${sim.s.expansion} / ${F.MAX_LAND}</p><div class="guide-tabs">${[['left','← Left'],['down','↓ Down']].map(([dir,label])=>`<button data-action="landDirection" data-direction="${dir}" class="${dir===landDirection?'chosen':''}" aria-pressed="${dir===landDirection}">${label}</button>`).join('')}</div>${map}<div class="land-types">${['industrial','mining','brownfield'].map(type=>{const d=F.World.TYPES[type];return `<button class="land-choice ${type===landType?'chosen':''}" data-action="landType" data-type="${type}" aria-pressed="${type===landType}"><b>${d.name}</b><span>${d.desc} This parcel: ${sim.landOffer(landDirection,type).oreCount} deposits.</span><strong>${money(sim.landOffer(landDirection,type).cost)} C</strong></button>`;}).join('')}</div><div class="land-total"><div><b>${def.name} · ${offer.w} × ${offer.h}</b><span>+${offer.w*offer.h} tiles · ${offer.oreCount} deposits · no new docks${def.blocks?' · 4 blocked tiles':''}</span></div><button class="primary-button" data-action="expand" ${max||sim.s.coins<offer.cost?'disabled':''}>${max?'All land purchased':'Buy · '+money(offer.cost)+' C'}</button></div>${!max&&sim.s.coins<offer.cost?`<p>Need ${money(Math.ceil(offer.cost-sim.s.coins))} more credits.</p>`:''}<p>Ore types are revealed after purchase. Use a targeted survey from shift 9 to find a specific metal.</p>`);
  }
  function sideOrders() {
    const offers=sim.sideOffers(), active=sim.s.side.active;
    const needs=o=>Object.entries(o.need).map(([id,n])=>`<div class="side-need"><canvas data-item="${id}"></canvas><span>${F.ITEMS[id].name}</span><b>${active?Math.min(o.progress[id]||0,n)+' / ':''}${n}</b></div>`).join('');
    openModal('sideOrders',header('THE ORDER BOARD','Choose your next job.')+`<p>One optional order at a time, with no deadline. Only deliveries made after accepting count. A shipment can also count toward your main contract.</p><div class="market-note"><b>Make what customers need.</b> Every shipment earns full price, whether or not an order needs it. Completing an order earns an extra reward.</div>${active?`<div class="side-card active"><small>ACTIVE ORDER</small><h3>${active.title}</h3>${needs(active)}<p>Completion reward <b>+${money(active.reward)} C</b></p><div class="modal-footer"><button class="primary-button" data-action="claimSide" ${sim.sideReady?'':'disabled'}>${sim.sideReady?'Collect reward →':'Deliver to any dock'}</button><button class="secondary-button" data-action="abandonSide">Cancel · lose order progress</button></div></div>`:`<div class="side-offers">${offers.map(o=>`<div class="side-card"><small>AVAILABLE ORDER</small><h3>${o.title}</h3>${needs(o)}<p>Completion reward <b>+${money(o.reward)} C</b></p><button class="primary-button" data-action="acceptSide" data-id="${o.id}">Accept order →</button></div>`).join('')}</div>`}<p>${sim.s.side.completed} extra orders completed. New offers arrive after completion or when an inactive board reaches a new shift.</p><button class="secondary-button" data-action="closeModal">Back to production →</button>`);save();
  }
  function machineGuide(type) {
    const d=F.BUILD[type];
    const recipes=d.recipes.map(r=>`<div class="guide-formula">${F.recipeText(r)}<small>${F.RECIPES[r].seconds}s base · sells for ${F.ITEMS[F.RECIPES[r].out].value} C${(F.RECIPES[r].unlock||0)>sim.s.stage?' · unlocks shift '+(F.RECIPES[r].unlock+1):''}</small></div>`).join('');
    return `<div class="guide-machine-head"><canvas data-machine="${type}"></canvas><div><h3>${d.name}</h3><span>${d.cost} C · ${sim.s.stage<d.unlock?'Unlocks shift '+(d.unlock+1):'Available now'}</span></div></div><p>${esc(d.tip)}</p><b class="guide-label">WHERE TO PLACE</b><p>${d.placement}</p>${recipes || '<p>'+ (type==='drill'?'Produces the deposit’s ore every 2.2 seconds before upgrades. Deposits never run out.':'Connect the output arrow to another conveyor, machine input or green shipping dock.')+'</p>'}<b class="guide-label">UPGRADES & TROUBLESHOOTING</b><p>10 upgrade levels, starting at 0. Each upgrade adds 10% of base ${F.transport({type})?'transport':'production'} speed: 100%, 110%, 120% … 200%. Orange light means the output is blocked.</p>`;
  }
  let guideFilter='all', guideSearch='';
  const producer = item => Object.entries(F.BUILD).find(([,d])=>d.recipes.includes(item));
  function guideRows() {
    const rows=Object.entries(F.RECIPES).filter(([id,r])=>{
      const d=producer(id)?.[1];if(!d)return false;
      return (guideFilter!=='alloys'||d===F.BUILD.alloyFurnace) && (guideFilter!=='order'||Object.hasOwn(sim.order.need,id)) && (F.recipeText(id)+' '+d.name).toLowerCase().includes(guideSearch.toLowerCase());
    });
    $('guideResults').innerHTML=rows.length?rows.map(([id,r])=>{const [type,d]=producer(id);return `<div class="handbook-recipe"><canvas data-item="${r.out}"></canvas><div><b>${F.ITEMS[r.out].name}</b><span>${F.recipeText(id)}</span><small>${d.name} · ${r.seconds}s · sell ${F.ITEMS[r.out].value} C · shift ${Math.max(d.unlock,r.unlock||0,id==='gear'?2:0)+1}</small></div><button data-action="recipeChain" data-item="${id}">How?</button></div>`;}).join(''):'<p>No matching recipes.</p>';paintIcons($('guideResults'));
  }
  function handbook(filter='all') {
    guideFilter=filter;guideSearch='';
    openModal('handbook',header('FACTORY FIELD GUIDE','From ore to orbit.')+`<p>8 metals · 6 alloys · 36 machines · 40 shifts. Recipes are simplified for the game. Click <b>How?</b> for the full ingredient chain.</p><div class="guide-tabs"><button data-action="guideTab" data-filter="all" class="${filter==='all'?'chosen':''}">All recipes</button><button data-action="guideTab" data-filter="alloys" class="${filter==='alloys'?'chosen':''}">Metal alloys</button><button data-action="guideTab" data-filter="order" class="${filter==='order'?'chosen':''}">Current order</button><button data-action="geology">Ore & survey</button><button data-action="campaign">40 shifts</button></div><label class="guide-search">Find a material or machine<input id="guideSearch" type="search" placeholder="Gold, bronze, motor…" autocomplete="off"></label><div id="guideResults"></div><p>Machine arrows are outputs. Feed from the other three sides. Inspect an Alloy furnace to change its recipe. Finish the current batch before the new recipe starts.</p>`,'handbook');guideRows();
  }
  document.addEventListener('input',e=>{if(e.target.id==='guideSearch'){guideSearch=e.target.value;guideRows();}});
  function recipeChain(item) {
    const steps=[],seen=new Set();
    function visit(id){if(seen.has(id))return;seen.add(id);const r=F.RECIPES[id];if(!r){steps.push(`<li><b>${F.ITEMS[id].name}</b> — Extractor on a ${F.ORES[id]?.symbol||''} deposit.</li>`);return;}Object.keys(r.need).forEach(visit);steps.push(`<li><b>${producer(id)[1].name}</b><span>${F.recipeText(id)}</span></li>`);}
    visit(item);
    openModal('chain',header('PRODUCTION PLAN',F.ITEMS[item].name)+`<p>Build in this order. Quantities shown are per batch, not total ore demand. Splitters share ingredients between lines.</p><ol class="chain-steps">${steps.join('')}</ol><button class="secondary-button" data-action="guideTab" data-filter="all">Back to recipes</button>`);
  }
  function geology() {
    const empty=Object.entries(sim.deposits).filter(([k])=>sim.isExpansionDeposit(k) && !sim.s.tiles[k]);
    openModal('geology',header('GEOLOGY & EXPLORATION','Find your next metal.')+`<p>Per 56 tiles, industrial and abandoned land create 2 deposits; mining land creates 4. Larger parcels get proportionally more, rounded to the nearest whole deposit. Positions and metals are random. Every deposit is permanent, unlimited and saved. Gold: 4% per deposit; silver: 8%. Randomness affects discoveries, not every extracted item.</p><div class="ore-grid">${Object.entries(F.ORES).map(([id,d])=>`<div><canvas data-item="${id}"></canvas><b>${F.ITEMS[id].name}</b><small>${d.weight}% chance</small></div>`).join('')}</div><h3>Targeted survey</h3><p>From shift 9, pay credits to replace an empty expansion deposit with a chosen ore. Store its Extractor first. Starting deposits stay protected. New factories have guaranteed iron and copper, plus 2 random deposits with the same rare-metal chances. Gold can be mined immediately; its refinery unlocks later.</p>${sim.s.stage<8?'<p>Unlocks on shift 9.</p>':empty.length?`<div class="survey-form"><label>Empty deposit<select id="surveySpot">${empty.map(([k,ore])=>`<option value="${k}">${A.rowName(Number(k.split(',')[1]))}${colName(Number(k.split(',')[0]))} · ${F.ITEMS[ore].name}</option>`).join('')}</select></label><label>Find this ore<select id="surveyOre">${Object.entries(F.ORES).map(([id])=>`<option value="${id}">${F.ITEMS[id].name} · ${sim.surveyCost(id)} C</option>`).join('')}</select></label><button class="primary-button" data-action="survey">Survey selected deposit</button></div>`:'<p>Expand the floor, or store an Extractor on an existing expansion deposit.</p>'}<div class="modal-footer"><button class="secondary-button" data-action="guideTab" data-filter="all">Recipes</button><button class="secondary-button" data-action="landMenu">Expand land</button></div>`);
  }
  function campaign() {
    openModal('campaign',header('40 SHIFTS','Your factory journey.')+`<p>Foundations → metallurgy → electronics → aerospace. Rewards below exclude speed bonuses. Complete contracts in order; there is no failure timer.</p><div class="campaign-list">${F.CONTRACTS.map((c,i)=>`<div class="${i===sim.s.stage?'current':''}"><b>${i<sim.s.stage?'✓':String(i+1).padStart(2,'0')} · ${c.title}</b><span>${Object.entries(c.need).map(([id,n])=>n+' '+F.ITEMS[id].name).join(' · ')}</span><small>+${money(c.reward)} C${i===sim.s.stage?' · CURRENT SHIFT':''}</small></div>`).join('')}</div>`);
  }
  function help() {
    openModal('help', header('A FEW GOOD CONNECTIONS', 'Make yourself at home.') + `<div class="help-grid"><div><b>Build a line</b><p>Pick a machine, then tap a tile. Conveyors can be replaced directly by machines. Extractors need a marked ore deposit.</p></div><div><b>Draw conveyors</b><p>Drag across tiles. Corners turn automatically. A tap places a single belt in the shown direction. R rotates the next placement.</p></div><div><b>Inspect & improve</b><p>Choose the arrow tool, then a machine. Rotate it, change a Press recipe, or upgrade speed. Recycle refunds purchases and upgrades. Starter equipment goes into storage and can be placed again for free.</p></div><div><b>Move the view</b><p>Wheel over selected equipment rotates its outputs; elsewhere it zooms. Drag the background outside the floor, use Pan or middle mouse to move the view. On touch, drag empty floor or use two fingers to pan and pinch to zoom.</p></div><div><b>Select & move groups</b><p>Desktop: drag a box on empty floor or Shift-click objects. Touch: choose Select and tap objects to add or remove them. Right-click or use Actions for group upgrades, movement and recycling. Drag equipment in Inspect, or press Move and tap a destination. Green previews fit; red previews explain the obstacle. Recycling always asks for confirmation.</p></div><div><b>Read the line</b><p>Green lamp: working. Orange lamp: output blocked. Check arrows and recipes. Machines need a clear output and the right ingredients.</p></div><div><b>Take your time</b><p>Space pauses; 1–7 pick machines; V inspects; X recycles; Z undoes a build. Undo clears materials in transit. Paused planning does not use contract time.</p></div></div><p>All goods always sell at full price. Orders add completion rewards. Machine upgrades start at level 0 (100%) and add 10% of the original speed each: level 10 is 200%. Speed depends only on this machine’s own upgrade level. Progress saves automatically every 10 seconds and after edits. A connected factory can earn up to 5 minutes of offline production. Use Settings to export a backup.</p><div class="modal-footer"><button class="secondary-button" data-action="enableTips">Show tutorial tips</button><button class="secondary-button" data-action="closeModal">Got it →</button></div>`);
  }
  function settings() {
    openModal('settings', header('OFF THE CLOCK', 'Make it your shift.') + `<div class="settings-row"><div><b>Factory sounds</b><span>Gentle, original procedural sound effects</span></div><button class="secondary-button" data-action="sound">${sim.s.sound ? 'Sound on' : 'Sound off'}</button></div><div class="settings-row"><div><b>Progress on this device</b><span>${platform.sdk ? 'CrazyGames Data module' : platform.storageAvailable ? 'Autosave every 10 seconds + after edits' : 'Browser storage unavailable — export a backup'}</span></div><button class="secondary-button" data-action="save">Save now</button></div><p>Before closing, use Save now and check the save status. Use Export save for a portable backup or to move your factory to another browser. Import replaces the current factory after confirmation.</p><div class="save-actions"><button class="secondary-button" data-action="export">Export save ↓</button><button class="secondary-button" data-action="import">Import save ↑</button></div><p class="setting-warning">Local saves belong to this browser and file location. Private browsing, clearing site data, or moving the HTML file may remove access to them.</p><div class="settings-row"><div><b>A fresh start</b><span>Clear your current factory and restart shift 01</span></div><button class="danger-button" data-action="confirmReset">New factory</button></div><p>Factory Shift v0.5.1 · Original art & sound · No ads in this prototype.</p>`);
  }
  function orderModal() { openModal('order', header(sim.order.client, esc(sim.order.title)) + `<p>${esc(sim.order.hint)}</p><div class="requirements">${requirementsHTML()}</div><div class="contract-reward"><span>Contract reward</span><b>+${money(sim.order.reward)} C</b></div><button id="modalClaim" class="primary-button" data-action="claimOrBack">${sim.ready ? 'Complete contract →' : 'Back to the floor'}</button>`, 'order-modal'); updateUI(); }
  function claim() {
    const result = sim.complete(); if (!result) return;
    sounds.win(); if (sim.s.stage === F.CONTRACTS.length) platform.event('happytime');
    clearSelection();
    openModal('result', `<span class="eyebrow">SHIFT ${String(result.stage + 1).padStart(2, '0')} COMPLETE</span><div class="result-stars">${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}</div><h2 id="modalTitle" class="result-title">${result.stage === F.CONTRACTS.length-1 ? 'A factory worth being proud of.' : 'A shift well spent.'}</h2><p style="text-align:center">${esc(result.title)} · Delivered, down to the last piece.</p><div class="result-stat"><div><b>${clock(result.seconds)}</b><small>SHIFT TIME</small></div><div><b>+${money(result.reward + result.bonus)} C</b><small>${result.bonus ? `INCLUDES ${result.bonus} SPEED BONUS` : 'CONTRACT REWARD'}</small></div></div><div class="unlock-card"><span>↗</span><b>${esc(result.unlock)}</b></div><p>${esc(sim.order.hint)}</p><button class="primary-button" data-action="nextShift">${result.stage === F.CONTRACTS.length-1 ? 'Begin endless shifts' : 'Next shift'} →</button>`);
    save();
  }
  function exportSave() {
    save(); const blob = new Blob([sim.serialize()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Factory-Shift-save-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Save exported. Keep it somewhere safe.');
  }
  function takeAction(action, el) {
    sounds.unlock();
    if (action === 'machineInfo') { openModal('machineGuide',header('EQUIPMENT GUIDE',F.BUILD[el.dataset.type].name)+machineGuide(el.dataset.type)); return; }
    if (action === 'guideTab') { handbook(el.dataset.filter); return; }
    if (action === 'recipeChain') { recipeChain(el.dataset.item); return; }
    if (action === 'geology') { geology(); return; }
    if (action === 'campaign') { campaign(); return; }
    if (action === 'landMenu') { landMenu(); return; }
    if (action === 'landDirection') { landDirection=el.dataset.direction; landMenu(); return; }
    if (action === 'landType') { landType=el.dataset.type; landMenu(); return; }
    if (action === 'sideOrders') { sideOrders(); return; }
    if (action === 'acceptSide') { if(sim.acceptSide(el.dataset.id)){save();closeModal();toast('Order accepted. Future deliveries now count.');} return; }
    if (action === 'claimSide') { const done=sim.claimSide();if(done){save();sounds.win();sideOrders();toast('Order complete: +'+money(done.reward)+' C');}return; }
    if (action === 'abandonSide') { sim.abandonSide();save();sideOrders();return; }
    if (action === 'survey') { const k=$('surveySpot').value, ore=$('surveyOre').value; if(sim.survey(k,ore)){save();geology();toast('Survey complete: '+F.ITEMS[ore].name+'.');}else toast('Choose a different ore on an empty expansion deposit and check your credits.'); return; }
    if (action === 'start') { sim.s.started = true; manualPaused = false; closeModal(); if (startMessage) { toast(startMessage, 6500); startMessage = ''; } return; }
    if (action === 'reload') { window.location.reload(); return; }
    if (action === 'closeModal') { if (menu !== 'intro') closeModal(); return; }
    if (action === 'nextShift') { if (sim.s.stage === 1) selectTool('press'); else selectTool('select'); closeModal(); return; }
    if (action === 'claimOrBack') { if (sim.ready) claim(); else closeModal(); return; }
    if (action === 'enableTips') { sim.s.tutorial = true; closeModal(); return; }
    if (action === 'expand') { if (sim.expand(landDirection,landType)) { const land=sim.s.lands[sim.s.lands.length-1]; renderer.syncWorld(sim); renderer.focusTile(land.x+land.w/2-.5,land.y+land.h/2-.5); sounds.win(); closeModal(); save(); toast('New '+F.World.TYPES[land.type].name.toLowerCase()+' land open. Route goods to your existing docks on the right.'); } else landMenu(); return; }
    if (action === 'sound') { sim.s.sound = !sim.s.sound; sounds.unlock(); settings(); save(); return; }
    if (action === 'save') { save(false); return; }
    if (action === 'export') { exportSave(); return; }
    if (action === 'import') { $('importInput').value = ''; $('importInput').click(); return; }
    if (action === 'confirmReset') { openModal('reset', header('START OVER?', 'Build something new.') + '<p>This replaces your current factory, credits, and progress. Export a backup first if you might want to return.</p><div class="modal-footer"><button class="secondary-button" data-action="settings">Cancel</button><button class="danger-button" data-action="reset">Start a new factory</button></div>'); return; }
    if (action === 'settings') { settings(); return; }
    if (action === 'reset') {
      sim = new F.Simulation(); sim.s.started = true; saveBlocked = false; manualPaused = false; clearSelection(); renderer.syncWorld(sim); renderer.fit(); selectTool('belt'); closeModal(); save(); return;
    }
    if (action === 'confirmImport') {
      if (!pendingImport) return; sim = new F.Simulation(pendingImport); pendingImport = null; sim.s.started = true; sim.s.savedAt = Date.now(); saveBlocked = false; manualPaused = false; clearSelection(); renderer.syncWorld(sim); renderer.fit(); inspectKey = ''; priorStage = -1; selectTool('select'); closeModal(); save(); toast('Factory restored. Welcome back.'); return;
    }
    if (action === 'hideActions') { hideActions(); return; }
    if (action === 'cancelMove') { cancelMove(); updateUI(); return; }
    if (action === 'confirmRecycle') {
      if (menu !== 'recycle' || !pendingRecycle.length) return;
      sim.removeMany(pendingRecycle); pendingRecycle=[]; clearSelection(); closeModal(); save(); return;
    }
    if (action === 'closeInspector') { clearSelection(); updateUI(); return; }
    if (action === 'moveMachine') { startMove(); return; }
    if (action === 'selectionActions') { actionMenu({x:renderer.width-222,y:renderer.height-270}); return; }
    if (action === 'recycleMachine') { recyclePrompt(selection); return; }
    if (action === 'rotateMachine' || action === 'upgradeMachine') {
      if(action==='rotateMachine') sim.rotateMany(selection); else if(!sim.upgradeMany(selection)) toast('Check your credits or upgrade limits.');
      hideActions(); sounds.tone(410,.07); updateUI(); showInspector(true); save(); return;
    }
    if (!selected) return;
    const { x, y } = selected, t = sim.s.tiles[F.key(x, y)]; if (!t) return;
    if (action === 'recipe') { sim.setRecipe(x, y, el.dataset.recipe); toast('Recipe changed. Any current batch finishes first.'); }
    if (action === 'copyMachine') { direction = t.dir; renderer.dir = direction; $('directionArrow').textContent = ['→', '↓', '←', '↑'][direction]; selectTool(t.type); }
    sounds.tone(410, .07); updateUI(); showInspector(true); save();
  }
  document.addEventListener('click', e => { const el = e.target.closest('[data-action]'); if (el) takeAction(el.dataset.action, el); const tab = e.target.closest('[data-category]'); if (tab) { category = tab.dataset.category; buildCards(); } const b = e.target.closest('[data-tool]'); if (b) selectTool(b.dataset.tool); });
  document.addEventListener('pointerdown', () => sounds.unlock(), { passive: true });
  document.addEventListener('touchend', () => sounds.unlock(), { passive: true });
  $('pauseButton').onclick = () => { manualPaused = !manualPaused; syncPlaying(); updateUI(); save(); };
  $('resumeButton').onclick = () => { manualPaused = false; syncPlaying(); updateUI(); save(); };
  $('speedButton').onclick = () => { speed = speed === 1 ? 2 : 1; $('speedButton').textContent = `${speed}×`; toast(`Simulation speed: ${speed}×`); };
  $('rotateButton').onclick = rotate; $('undoButton').onclick = () => { if (sim.undo()) { clearSelection(); sounds.tone(320, .08); toast('Layout restored. In-transit materials cleared.'); updateUI(); save(); } };
  $('settingsButton').onclick = settings; $('upgradesButton').onclick = upgrades; $('recipesButton').onclick = () => handbook(); $('helpButton').onclick = help;
  $('expandButton').onclick = landMenu; $('ordersButton').onclick = sideOrders; $('guideButton').onclick = () => handbook();
  $('shipButton').onclick = claim; $('mobileContract').onclick = () => sim.ready ? claim() : orderModal();
  $('dismissCoach').onclick = () => { sim.s.tutorial = false; updateUI(); save(); };
  $('zoomIn').onclick = () => renderer.zoomBy(1.3); $('zoomOut').onclick = () => renderer.zoomBy(1 / 1.3); $('fitButton').onclick = () => renderer.fit();
  let pendingImport = null;
  $('importInput').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5000000) { toast('Save file is too large. Choose a Factory Shift JSON save.'); return; }
    try { pendingImport = F.Simulation.parse(await file.text()); openModal('import', header('RESTORE FACTORY?', 'Pick up where you left off.') + `<p>Import shift ${pendingImport.stage + 1} with ${money(pendingImport.coins)} credits? This replaces your current progress.</p><div class="modal-footer"><button class="secondary-button" data-action="settings">Cancel</button><button class="primary-button" data-action="confirmImport">Restore factory</button></div>`); }
    catch (err) { toast(`Could not import: ${err.message}`, 5500); }
  };
  // Pointer input: one route is one undo operation; no placement on pinch start.
  const canvas = $('factoryCanvas'), pointers = new Map(); let gesture = null, pinch = null;
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function cellInside(p) { return sim.inside(p.x,p.y); }
  function inspectAt(cell, additive=false) {
    const t = sim.s.tiles[F.key(cell.x, cell.y)];
    if (t) {
      const has=selection.some(p=>p.x===cell.x&&p.y===cell.y);
      setSelection(additive ? has ? selection.filter(p=>p.x!==cell.x||p.y!==cell.y) : [...selection,cell] : [cell]); showInspector(true);
    }
    else { clearSelection(); if (sim.docks.has(F.key(cell.x, cell.y))) toast('Shipping dock: connect any product here to earn credits.'); else if (sim.deposits[F.key(cell.x, cell.y)]) toast(`${F.ITEMS[sim.deposits[F.key(cell.x, cell.y)]].name} deposit — place an Extractor here.`); }
    updateUI();
  }
  function editAt(cell, isDrag = false) {
    if (!cellInside(cell)) return;
    if (selecting()) { if (!isDrag) inspectAt(cell,tool==='multi'||gesture?.additive); return; }
    if (tool === 'pan') return;
    const old = sim.s.tiles[F.key(cell.x, cell.y)];
    if (tool === 'erase') { if (old) { gesture.eraseCells.set(F.key(cell.x,cell.y),cell); renderer.selection=[...gesture.eraseCells.values()]; } return; }
    if (tool === 'belt' && old?.type === 'belt' && old.dir === direction) return;
    if (F.BUILD[tool] && !(tool === 'belt' && old?.type === 'belt')) {
      const error = sim.allowed(tool, cell.x, cell.y);
      if (error) { if (!isDrag) toast(error); return; }
    }
    if (!gesture.recorded) { sim.checkpoint(); gesture.recorded = true; }
    let error = '';
    if (tool === 'erase') sim.remove(cell.x, cell.y, false);
    else if (F.BUILD[tool]) error = sim.place(tool, cell.x, cell.y, direction, false);
    if (error) { if (!isDrag) toast(error); }
    else { renderer.burst(cell.x, cell.y, tool === 'erase' ? '#dfa875' : '#d6d6a0'); sounds.tone(tool === 'erase' ? 260 : 420, .04); }
    updateUI();
  }
  function drawTo(cell) {
    if (!cellInside(cell)) return;
    let p = gesture.lastCell;
    if (!p || !cellInside(p)) { gesture.lastCell = cell; return; }
    let guard = 0;
    while ((p.x !== cell.x || p.y !== cell.y) && guard++ < sim.width + sim.height) {
      const dx = cell.x - p.x, dy = cell.y - p.y;
      const d = Math.abs(dx) >= Math.abs(dy) && dx !== 0 ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      if (tool === 'belt') {
        direction = d; renderer.dir = d; $('directionArrow').textContent = ['→', '↓', '←', '↑'][d];
        editAt(p, true);
      }
      const next = { x: p.x + F.DIR[d][0], y: p.y + F.DIR[d][1] }; editAt(next, true); p = next;
    }
    gesture.lastCell = cell;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!loaded || menu || !sim.s.started) return;
    const p=point(e), cell=renderer.cellAt(p.x,p.y), has=selection.some(q=>q.x===cell.x&&q.y===cell.y);
    if (e.button === 2) {
      e.preventDefault(); cancelMove(); if(!selecting()) selectTool('select');
      if(!has && sim.s.tiles[F.key(cell.x,cell.y)]) inspectAt(cell);
      if(selection.length) actionMenu(p); return;
    }
    e.preventDefault(); hideActions(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      if (gesture?.recorded) save();
      const [a, b] = [...pointers.values()]; pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture=null; cancelMove(); renderer.selectionRect=null; renderer.selection=selection; updateUI(); return;
    }
    if (pointers.size > 2 || pinch) return;
    const touch=e.pointerType==='touch', occupied=!!sim.s.tiles[F.key(cell.x,cell.y)];
    gesture = { id:e.pointerId, start:p, last:p, startCell:cell, lastCell:cell, moved:false, recorded:false,
      additive:!!e.shiftKey || tool==='multi', original:selection.slice(), eraseCells:new Map(),
      pan:!cellInside(cell)||tool==='pan'||e.button===1||(touch&&selecting()&&!occupied&&!moving),
      box:cellInside(cell)&&selecting()&&!touch&&!moving&&(e.shiftKey||tool==='multi'||!occupied),
      dragMove:selecting()&&!e.shiftKey&&tool!=='multi'&&occupied,
      placeMove:moving };
  });
  canvas.addEventListener('pointermove', e => {
    const p=point(e), cell=renderer.cellAt(p.x,p.y); renderer.hover=cell;
    if (moving) previewMove(cell);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      renderer.zoomBy(distance / Math.max(1, pinch.distance), x, y); renderer.panX += x - pinch.x; renderer.panY += y - pinch.y; renderer.layout(); pinch = { distance, x, y }; return;
    }
    if (!gesture || gesture.id !== e.pointerId) return;
    if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 7) gesture.moved = true;
    if (gesture.moved && gesture.pan) { renderer.panX += p.x - gesture.last.x; renderer.panY += p.y - gesture.last.y; renderer.layout(); }
    else if (gesture.moved && gesture.box) {
      const a=gesture.startCell, rect={x:Math.min(a.x,cell.x),y:Math.min(a.y,cell.y),w:Math.abs(a.x-cell.x)+1,h:Math.abs(a.y-cell.y)+1};
      renderer.selectionRect=rect;
      const cells=Object.values(sim.s.tiles).filter(t=>t.x>=rect.x&&t.x<rect.x+rect.w&&t.y>=rect.y&&t.y<rect.y+rect.h);
      setSelection(gesture.additive?[...gesture.original,...cells]:cells); showInspector(true);
    }
    else if (gesture.moved && (gesture.dragMove || gesture.placeMove)) {
      if (!moving) {
        if (!selection.some(q=>q.x===gesture.startCell.x&&q.y===gesture.startCell.y)) setSelection([gesture.startCell]);
        startMove(); moveAnchor={...gesture.startCell};
      } else if(gesture.placeMove && selection.some(q=>q.x===gesture.startCell.x&&q.y===gesture.startCell.y)) moveAnchor={...gesture.startCell};
      previewMove(cell);
    }
    else if (gesture.moved && (tool === 'belt' || tool === 'erase')) { if (!gesture.recorded) editAt(gesture.startCell, true); drawTo(cell); }
    gesture.last=p;
  });
  function release(e, cancel=false) {
    if (!pointers.has(e.pointerId)) return;
    if (gesture && gesture.id===e.pointerId) {
      if (cancel) { if(gesture.box)setSelection(gesture.original); cancelMove(); }
      else if (!gesture.pan && moving && (gesture.placeMove || (gesture.moved&&gesture.dragMove))) finishMove(renderer.cellAt(point(e).x,point(e).y));
      else if (!gesture.moved) editAt(gesture.startCell);
      if (!cancel && gesture.eraseCells.size) recyclePrompt([...gesture.eraseCells.values()]);
      if (gesture.recorded) save();
    }
    renderer.selectionRect=null; renderer.selection=selection;
    pointers.delete(e.pointerId); if (!pointers.size) { pinch=null; gesture=null; } else if(pinch) gesture=null;
    updateUI(); try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  canvas.addEventListener('pointerup',e=>release(e)); canvas.addEventListener('pointercancel',e=>release(e,true));
  canvas.addEventListener('pointerleave',()=>{if(!pointers.size)renderer.hover=null;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{
    e.preventDefault(); if(menu||moving||pointers.size)return;
    const p=point(e), cell=renderer.cellAt(p.x,p.y);
    if(selecting()&&!e.ctrlKey&&selection.some(q=>q.x===cell.x&&q.y===cell.y)) {
      if(e.deltaY && performance.now()-lastWheelTurn>160) { sim.rotateMany(selection,e.deltaY>0?1:-1); lastWheelTurn=performance.now(); showInspector(true); save(); }
    } else renderer.zoomBy(Math.exp(-e.deltaY*.0015),p.x,p.y);
  },{passive:false});
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (menu) {
      if (e.key === 'Escape' && !['intro', 'result', 'platformError'].includes(menu)) { e.preventDefault(); closeModal(); }
      if (e.key === 'Tab') { const focusable = [...$('modal').querySelectorAll('button:not(:disabled),input')]; const first = focusable[0], last = focusable[focusable.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === $('modal'))) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      return;
    }
    if (!loaded || !sim.s.started) return;
    const key = e.key.toLowerCase();
    if (key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('pauseButton').click(); }
    if (key === 'r') rotate(); if (key === 'v') selectTool('select'); if (key === 'h') selectTool('pan'); if (key === 'x') selectTool('erase'); if (key === 'z') $('undoButton').click();
    if (/^[1-7]$/.test(key)) selectTool(Object.keys(F.BUILD)[Number(key) - 1]);
    if (key === 'escape') { if(moving) { cancelMove(); updateUI(); } else { selectTool('select'); clearSelection(); } }
  });
  function resize() { const rect = $('viewport').getBoundingClientRect(); renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1); }
  new ResizeObserver(resize).observe($('viewport')); window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenEligible = playingBeforeHide(); hiddenSince = Date.now(); save(); if (sounds.context?.state === 'running') sounds.context.suspend().catch(() => {}); }
    else if (hiddenSince) { if (hiddenEligible && sim.s.started) { const result = sim.offline((Date.now() - hiddenSince) / 1000); if (result.coins > 0) toast(`While you were away: +${money(result.coins)} C`); } hiddenSince = 0; accumulator = 0; lastFrame = performance.now(); save(); }
    syncPlaying();
  });
  function playingBeforeHide() { return loaded && sim.s.started && !manualPaused && !menu; }
  window.addEventListener('beforeunload', event => {
    if (!loaded || !sim.s.started || saveBlocked) return;
    save();
    // The browser owns the confirmation wording and may suppress it on mobile.
    event.preventDefault(); event.returnValue = '';
  });
  window.addEventListener('pagehide', () => { save(); platform.setPlaying(false); });
  function frame(now) {
    const dt = Math.min(.25, Math.max(0, (now - (lastFrame || now)) / 1000)); lastFrame = now;
    if (lastPlaying !== playing()) syncPlaying();
    if (playing()) {
      accumulator += dt * speed;
      while (accumulator >= F.STEP) { sim.step(F.STEP); accumulator -= F.STEP; }
      saveClock += dt;
    }
    for (const event of sim.events.splice(0)) {
      if (event.type === 'ship') { renderer.burst(event.x, event.y, '#cbe0a6', `+${event.value} C`); sounds.ship(); }
      if (event.type === 'ready') { toast('Contract ready! Complete it on the dispatch board.', 5000); sounds.win(); save(); }
    }
    uiClock += dt; if (uiClock > .18) { updateUI(); uiClock = 0; }
    if (saveClock > 10) { save(); saveClock = 0; }
    renderer.render(sim, sim.s.time, dt); requestAnimationFrame(frame);
  }
  async function boot() {
    resize(); renderer.render(sim, 0); selectTool('belt');
    let raw;
    try { await platform.init(); raw = platform.load(); }
    catch (err) { openModal('platformError', `<span class="eyebrow">CONNECTION UNAVAILABLE</span><h2 id="modalTitle">Your factory is safe.</h2><p>${esc(err.message)}</p><button class="primary-button" data-action="reload">Retry connection</button>`); return; }
    if (raw) {
      try { sim = new F.Simulation(F.Simulation.parse(raw)); savedState = true; if (sim.s.offlineEligible && sim.s.savedAt) carriedOffline = sim.offline(Math.max(0, (Date.now() - sim.s.savedAt) / 1000)); }
      catch (_) { saveBlocked = true; $('saveStatus').textContent = 'Old save kept · import or reset'; startMessage = 'An incompatible save was found and kept untouched. Export this factory, or choose New factory in Settings to enable saving.'; }
    }
    if (!platform.storageAvailable) startMessage = 'This browser blocks local saving. Use Settings → Export save to keep your progress.';
    loaded = true; priorStage = -1; selectTool(savedState ? 'select' : 'belt'); updateUI(); platform.event('loadingStop');
    if (savedState && sim.s.started) {
      closeModal();
      if (startMessage) { toast(startMessage, 6500); startMessage = ''; }
      else if (carriedOffline?.coins > 0) toast(`While you were away: +${money(carriedOffline.coins)} C`, 5000);
    } else intro();
    requestAnimationFrame(frame);
  }
  boot();
})();
