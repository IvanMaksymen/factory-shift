const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('both distributable HTML files preserve source scripts and parse',()=>{
  const root=path.resolve(__dirname,'..');
  const source=['i18n.js','world.js','content.js','sim.js','render.js','platform.js','app.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n').replace(/<\/script/gi,'<\\/script');
  for(const dir of ['dist','crazygames']){
    const html=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
    assert.ok(html.includes(source),dir+' must embed source verbatim');
    for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:dir+'/index.html'});
  }
});
