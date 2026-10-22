/* Usage: node build.cjs [--crazygames]. No dependencies or package install. */
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname, src = path.join(root, 'src'), cg = process.argv.includes('--crazygames');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace('<!-- STYLES -->', `<style>\n${fs.readFileSync(path.join(src, 'style.css'), 'utf8')}\n</style>`);
const code = ['world.js', 'content.js', 'sim.js', 'render.js', 'platform.js', 'app.js'].map(file => fs.readFileSync(path.join(src, file), 'utf8')).join('\n');
const sdk = cg ? '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n<script>window.FACTORY_PLATFORM="crazygames";</script>\n' : '';
html = html.replace('<!-- SCRIPTS -->', `${sdk}<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`);
const dir = path.join(root, cg ? 'crazygames' : 'dist'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`${cg ? 'CrazyGames SDK v3' : 'Standalone offline'} build: ${Buffer.byteLength(html)} bytes → ${dir}/index.html`);
