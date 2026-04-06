/**
 * Script post-build për Electron
 * 1. Kopjon vendor files në dist/vendor/
 * 2. Zëvendëson CDN URL-et me paths lokale në dist/index.html
 * 3. Ndryshon /assets/ → ./assets/ (relative paths për file://)
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const DIST    = path.join(ROOT, 'dist');
const VENDOR_SRC = path.join(__dirname, 'vendor');
const VENDOR_DST = path.join(DIST, 'vendor');

// 1. Kopjo vendor
if (!fs.existsSync(VENDOR_DST)) fs.mkdirSync(VENDOR_DST, { recursive: true });
fs.readdirSync(VENDOR_SRC).forEach(f => {
  fs.copyFileSync(path.join(VENDOR_SRC, f), path.join(VENDOR_DST, f));
});
console.log('✓ Vendor files kopjuar në dist/vendor/');

// 2. Lexo index.html
const htmlPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 3. Zëvendëso CDN scripts me lokale
html = html.replace(
  '<script src="https://cdn.tailwindcss.com"></script>',
  '<!-- Tailwind loaded via CDN or local -->'
);
html = html.replace(
  /src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]+"/,
  'src="./vendor/xlsx.min.js"'
);
html = html.replace(
  /src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf\.js\/[^"]+"/,
  'src="./vendor/html2pdf.min.js"'
);
html = html.replace(
  /src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/[^"]+"/,
  'src="./vendor/html2canvas.min.js"'
);
html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com[^"]*" rel="stylesheet">/,
  '<link rel="stylesheet" href="./vendor/inter.css">'
);

// 4. Bëj paths relative (file:// protocol nuk suporton /assets/)
html = html.replace(/src="\/assets\//g, 'src="./assets/');
html = html.replace(/href="\/assets\//g, 'href="./assets/');
html = html.replace(/href="\/assets\//g, 'href="./assets/');

// 5. Hiq importmap (Vite i bëndle tashmë)
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/m, '<!-- importmap removed for electron -->');

// 6. Shto Tailwind lokal (offline)
html = html.replace(
  '<!-- Tailwind loaded via CDN or local -->',
  '<script src="./vendor/tailwind.min.js"></script>'
);

fs.writeFileSync(htmlPath, html);
console.log('✓ dist/index.html rregulluar për Electron');
console.log('  - CDN → vendor lokal');
console.log('  - /assets/ → ./assets/ (relative paths)');
console.log('  - importmap hequr');
