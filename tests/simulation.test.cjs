'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const F = require('./helpers/legacy-sim.cjs');
const { Simulation, fresh, tile, key } = F;
function run(sim, seconds) { for (let t = 0; t < seconds; t += .05) sim.step(.05); }
function waitReady(sim, maxSeconds = 900) { let t = 0; while (!sim.ready && t < maxSeconds) { sim.step(.05); t += .05; } assert.ok(sim.ready, `Shift ${sim.s.stage + 1} did not finish: ${JSON.stringify(sim.s.delivered)}`); return t; }
function place(sim, type, x, y, dir = 0) { assert.equal(sim.place(type, x, y, dir), '', `${type} at ${x},${y}`); }
function copperLine(sim) {
  place(sim, 'drill', 4, 8, 3); place(sim, 'smelter', 4, 7); place(sim, 'wiremill', 5, 7);
  for (let x = 6; x <= 12; x++) place(sim, 'belt', x, 7, x === 12 ? 1 : 0);
  place(sim, 'belt', 12, 8);
}
test('Starter factory cannot ship through a gap; a real connection completes shift 1', () => {
  const sim = new Simulation(); run(sim, 40); assert.equal(sim.s.totalShipped, 0); assert.ok(sim.s.tiles['3,2'].blocked);
  place(sim, 'belt', 4, 2); waitReady(sim, 60); assert.ok(sim.s.totalShipped >= 8);
  const before = sim.s.coins, r = sim.complete(); assert.equal(sim.s.stage, 1); assert.equal(sim.s.coins, before + r.reward + r.bonus); assert.equal(sim.complete(), null);
});
test('Machines require compatible materials and a correct input side', () => {
  const sim = new Simulation(); const press = tile('press', 0, 0, 0);
  assert.equal(sim.accepts(press, 'ore', 0), false); assert.equal(sim.accepts(press, 'iron', 0), true);
  assert.equal(sim.accepts(press, 'iron', 2), false); assert.equal(sim.accepts(press, 'iron', 1), true);
  press.input.iron = 4; assert.equal(sim.accepts(press, 'iron', 0), false);
});
test('Belt movement advances at most one tile per simulation step', () => {
  const s = fresh(); s.tiles = {}; s.tiles['0,0'] = tile('belt', 0, 0); s.tiles['1,0'] = tile('belt', 1, 0); s.tiles['2,0'] = tile('belt', 2, 0);
  s.tiles['0,0'].out = { kind: 'iron', age: 1, from: 0 }; const sim = new Simulation(s); sim.step(.05);
  assert.equal(s.tiles['0,0'].out, null); assert.equal(s.tiles['1,0'].out.kind, 'iron'); assert.equal(s.tiles['2,0'].out, null);
});
test('Rejected building, recycling, upgrades and undo preserve the budget', () => {
  const sim = new Simulation(); const initial = sim.s.coins;
  assert.ok(sim.place('assembler', 0, 0)); assert.ok(sim.place('drill', 2, 0)); assert.ok(sim.place('belt', 13, 2)); assert.ok(sim.place('belt', 6, 4)); assert.equal(sim.s.coins, initial);
  place(sim, 'drill', 1, 6); assert.equal(sim.s.coins, initial - 90); assert.ok(sim.upgrade(1, 6)); const paid = sim.s.tiles['1,6'].paid;
  assert.ok(paid > 90); sim.remove(1, 6); assert.equal(sim.s.coins, initial); assert.ok(sim.undo()); assert.equal(sim.s.coins, initial - paid); sim.remove(1, 6); assert.equal(sim.s.coins, initial);
});
test('Undo cannot duplicate delivered materials', () => {
  const sim = new Simulation(); place(sim, 'belt', 4, 2); run(sim, 30); const coins = sim.s.coins, shipped = sim.s.totalShipped;
  place(sim, 'belt', 0, 0); sim.undo(); assert.equal(sim.s.coins, coins); assert.equal(sim.s.totalShipped, shipped);
  for (const t of Object.values(sim.s.tiles)) { assert.equal(t.out, null); assert.deepEqual(t.input, {}); }
});
test('Round-trip saves preserve a live factory and reject invalid input', () => {
  const sim = new Simulation(); place(sim, 'belt', 4, 2); run(sim, 7);
  const restored = new Simulation(Simulation.parse(sim.serialize())); run(sim, 18); run(restored, 18);
  assert.equal(restored.s.totalShipped, sim.s.totalShipped); assert.equal(restored.s.coins, sim.s.coins);
  assert.throws(() => Simulation.parse('{}')); assert.throws(() => Simulation.parse('{bad'));
  const s = fresh(); s.coins = Infinity; assert.throws(() => Simulation.parse(s));
  const bad = fresh(); bad.tiles['1,2'].type = '__proto__'; assert.throws(() => Simulation.parse(bad));
  const bad2 = fresh(); bad2.tiles['1,2'].input.ore = 999; assert.throws(() => Simulation.parse(bad2));
});
test('Offline production is real, capped at 5 minutes and never claims contracts', () => {
  const connected = new Simulation(); place(connected, 'belt', 4, 2); const result = connected.offline(999999);
  assert.equal(result.seconds, 300); assert.ok(result.coins > 0); assert.equal(connected.s.stage, 0); assert.equal(connected.ready, true);
  const blocked = new Simulation(); assert.equal(blocked.offline(300).coins, 0);
  assert.equal(connected.offline(-30).seconds, 0);
});
test('Adding machines never reduces another machines speed', () => {
  const s = fresh(); s.coins = 1000; s.stage = 5;
  s.tiles['1,6'] = tile('drill', 1, 6); s.tiles['4,8'] = tile('drill', 4, 8); s.tiles['9,8'] = tile('drill', 9, 8); s.tiles['3,6'] = tile('assembler', 3, 6);
  const sim = new Simulation(s); assert.equal(sim.productionSpeed(s.tiles['1,2']),1); assert.equal(sim.research('power'),false); assert.equal(sim.s.coins,1000);
});
test('Splitter alternates exits and reroutes when one is blocked', () => {
  const s = fresh(); s.stage = 2; s.tiles = {}; const sim = new Simulation(s);
  s.tiles['2,2'] = tile('splitter', 2, 2); s.tiles['2,3'] = tile('belt', 2, 3, 1); s.tiles['2,1'] = tile('belt', 2, 1, 3);
  s.tiles['2,2'].out = { kind: 'iron', age: 1, from: 0 }; sim.step(.05); assert.equal(s.tiles['2,3'].out.kind, 'iron');
  s.tiles['2,2'].out = { kind: 'iron', age: 1, from: 0 }; sim.step(.05); assert.equal(s.tiles['2,1'].out.kind, 'iron');
  s.tiles['2,1'].out = null; s.tiles['2,2'].out = { kind: 'iron', age: 1, from: 0 }; sim.step(.05); assert.equal(s.tiles['2,1'].out.kind, 'iron');
});
test('Assembly consumes exactly two gears and two wires per motor', () => {
  const s = fresh(); s.stage = 5; s.tiles = {}; const a = tile('assembler', 12, 6); s.tiles['12,6'] = a;
  a.input = { gear: 2, wire: 1 }; const sim = new Simulation(s); run(sim, 10); assert.equal(s.totalMade, 0);
  a.input.wire++; run(sim, 5.1); assert.equal(s.totalMade, 1); assert.equal(s.delivered.motor, 1); assert.equal(a.input.gear, 0); assert.equal(a.input.wire, 0);
  run(sim, 10); assert.equal(s.totalMade, 1);
});
test('All eight campaign contracts are achievable with earned funds and real routing', () => {
  const sim = new Simulation(); const timings = [];
  place(sim, 'belt', 4, 2); timings.push(waitReady(sim)); sim.complete();
  place(sim, 'press', 6, 2); timings.push(waitReady(sim)); sim.complete();
  sim.setRecipe(6, 2, 'gear'); timings.push(waitReady(sim)); sim.complete();
  copperLine(sim);  timings.push(waitReady(sim)); sim.complete();
  timings.push(waitReady(sim)); sim.complete();
  // Feed gears from the north and wire from the south into the assembler.
  place(sim, 'assembler', 10, 6);
  for (let y = 2; y <= 5; y++) place(sim, 'belt', 10, y, 1);
  place(sim, 'belt', 10, 7, 3); place(sim, 'belt', 11, 6); place(sim, 'belt', 12, 6);
  timings.push(waitReady(sim)); sim.complete();
  // A second iron deposit supplies an independent plate line around the bottom boundary.
  place(sim, 'drill', 1, 6, 1); place(sim, 'smelter', 1, 7, 1); place(sim, 'press', 1, 8, 1); place(sim, 'belt', 1, 9);
  for (let x = 2; x <= 13; x++) place(sim, 'belt', x, 9, x === 13 ? 3 : 0);
   timings.push(waitReady(sim)); sim.complete();
  // For shift 8, alternate the gear/wire outputs between shipping and assembly.
  place(sim, 'belt', 10, 2); place(sim, 'belt', 10, 7); run(sim, 180);
  assert.ok((sim.s.delivered.gear || 0) >= 24); assert.ok((sim.s.delivered.wire || 0) >= 30); assert.ok((sim.s.delivered.plate || 0) >= 24);
  place(sim, 'belt', 10, 2, 1); place(sim, 'belt', 10, 7, 3); timings.push(waitReady(sim)); sim.complete();
  assert.equal(sim.s.stage, 8); assert.equal(sim.s.records.length, 8); assert.ok(sim.s.coins > 0); assert.equal(sim.order.modifier,undefined);
  assert.doesNotThrow(() => Simulation.parse(sim.serialize()));
  console.log('Campaign timings (simulation seconds):', timings.map(Math.round).join(', '));
  console.log('Campaign ending credits:', Math.floor(sim.s.coins));
});
