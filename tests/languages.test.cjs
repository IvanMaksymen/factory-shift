const test=require('node:test'),assert=require('node:assert/strict'),F=require('../src/sim.js'),L=require('../src/i18n.js');
const {harness,settle}=require('./helpers/ui-harness.cjs');
function change(h,code){h.el('settingsButton').click();const select=h.el('languageSelect');select.value=code;h.document.emit('change',{target:select});}
const saved=h=>JSON.parse(h.mem.get('factory-shift-save-v1'));
test('Six offline catalogs cover all equipment, products, campaign titles and hints',()=>{
 assert.deepEqual(Object.keys(L.languages),['en','uk','ru','fr','de','es']);
 for(const code of ['uk','ru','fr','de','es']){
  L.set(code);for(const value of [...Object.values(F.BUILD).map(d=>d.name),...Object.values(F.ITEMS).map(d=>d.name),...F.CONTRACTS.flatMap(c=>[c.title,c.hint])])assert.ok(L.catalogs[code].has(value),`${code}: ${value}`);
  assert.notEqual(L.t('Settings'),'Settings');assert.ok(!L.t('SHIFT 04 COMPLETE').includes('COMPLETE'));assert.ok(!L.t('Upgrade 12 · 1,230 C').includes('Upgrade'));assert.ok(!L.t('Refund: 123 C. Starter machines returned: 2. Materials inside will be discarded.').includes('Refund'));
 }
 L.set('en');assert.equal(L.t('Factory Shift'),'Factory Shift');
});
test('Switch every language live, preserve factory state and restore language after reload',async()=>{
 const s=F.fresh();s.started=true;s.coins=12345;s.tiles['4,2']=F.tile('belt',4,2);const h=harness(JSON.stringify(s));await settle();
 const before=saved(h),labels={uk:'Мова',ru:'Язык',fr:'Langue',de:'Sprache',es:'Idioma',en:'Language'};
 for(const [code,label]of Object.entries(labels)){
  change(h,code);assert.equal(h.el('languageSelect').children.length,6);assert.match(h.el('modal').textContent,new RegExp(label));assert.equal(saved(h).language,code);assert.deepEqual(saved(h).tiles,before.tiles);assert.equal(saved(h).coins,12345);
  h.action('controls');assert.equal(h.el('modalBackdrop').hidden,false);const text=h.el('modal').textContent;assert.ok(text.includes('90°'));assert.ok(text.includes('1–7'));assert.ok(/Esc|Échap/.test(text));assert.ok(text.includes('Shift')||text.includes('Maj')||text.includes('Umschalt')||text.includes('Mayús'));
  h.action('settings');h.action('closeModal');
  const re=harness(h.mem.get('factory-shift-save-v1'));await settle();re.el('settingsButton').click();assert.match(re.el('modal').textContent,new RegExp(label));assert.equal(saved(re).language,code);
 }
 assert.match(h.el('toolDescription').textContent,/Inspect/);
});
test('Old and malformed language settings fall back to English without changing factory data',()=>{
 for(const language of [undefined,'xx','__proto__',{x:1}]){const s=F.fresh();s.language=language;const restored=F.Simulation.parse(JSON.stringify(s));assert.equal(restored.language,'en');assert.deepEqual(restored.tiles,s.tiles);}
});
test('Ukrainian material search, reset preference, safe rendered text and physical-key shortcuts',async()=>{
 const s=F.fresh();s.started=true;s.stage=39;s.language='uk';const h=harness(JSON.stringify(s));await settle();h.el('guideButton').click();
 const input=h.el('guideSearch');input.value='золот';h.document.emit('input',{target:input});assert.match(h.el('guideResults').textContent,/Золот/);assert.doesNotMatch(h.el('guideResults').textContent,/No matching/);h.action('closeModal');
 h.document.emit('keydown',{target:h.el('factoryCanvas'),key:'м',code:'KeyV'});h.tap(1,2);h.document.emit('keydown',{target:h.el('factoryCanvas'),key:'к',code:'KeyR'});assert.equal(saved(h).tiles['1,2'].dir,1);
 h.el('settingsButton').click();h.action('confirmReset');h.action('reset');assert.equal(saved(h).language,'uk');assert.equal(saved(h).stage,0);h.el('settingsButton').click();assert.match(h.el('modal').textContent,/Мова/);
});
