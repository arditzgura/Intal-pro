import sharp from 'sharp';

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#E53935"/>
      <stop offset="100%" style="stop-color:#B71C1C"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="112" ry="112" fill="url(#bg)"/>

  <!-- Document -->
  <rect x="156" y="62" width="200" height="248" rx="12" ry="12" fill="white" opacity="0.12"/>
  <rect x="168" y="74" width="176" height="234" rx="8" ry="8" fill="white" opacity="0.97"/>

  <!-- Fold corner -->
  <polygon points="296,74 344,74 344,122" fill="#E53935" opacity="0.3"/>
  <polygon points="296,74 344,122 296,122" fill="white" opacity="0.55"/>

  <!-- Lines -->
  <rect x="192" y="144" width="96" height="11" rx="5.5" fill="#C62828" opacity="0.85"/>
  <rect x="192" y="170" width="132" height="7" rx="3.5" fill="#C62828" opacity="0.25"/>
  <rect x="192" y="188" width="112" height="7" rx="3.5" fill="#C62828" opacity="0.25"/>
  <rect x="192" y="206" width="124" height="7" rx="3.5" fill="#C62828" opacity="0.25"/>
  <rect x="192" y="224" width="104" height="7" rx="3.5" fill="#C62828" opacity="0.25"/>
  <rect x="192" y="246" width="148" height="1.5" rx="1" fill="#E53935" opacity="0.3"/>
  <rect x="192" y="258" width="64" height="8" rx="4" fill="#C62828" opacity="0.28"/>
  <rect x="272" y="255" width="68" height="14" rx="7" fill="#E53935" opacity="0.9"/>

  <!-- INTAL PRO — e njëjtë linja, madhësi e barabartë -->
  <text x="256" y="410" font-family="Arial Black, Arial, sans-serif" font-weight="900"
        font-size="68" fill="white" text-anchor="middle" letter-spacing="-1">INTAL PRO</text>

  <!-- Vijë dekorative poshtë -->
  <rect x="156" y="428" width="200" height="3" rx="1.5" fill="white" opacity="0.3"/>
</svg>`;

await sharp(Buffer.from(svg512)).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg512)).resize(192, 192).png().toFile('public/icons/icon-192.png');
console.log('Done');
