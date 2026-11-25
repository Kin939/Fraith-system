const o={"preset:kobolds":{c1:"#f97316",c2:"#7c2d12",glyph:"⚒",subtitle:"CRYSTAL MINES"},"preset:obelisks":{c1:"#a855f7",c2:"#1e1b4b",glyph:"◈",subtitle:"ARCANE SEAL"},"preset:harbor":{c1:"#06b6d4",c2:"#0f172a",glyph:"⚓",subtitle:"PORT FRAITH"},"preset:blade":{c1:"#ec4899",c2:"#311042",glyph:"⚔",subtitle:"SOLARIS SHARDS"},"preset:kobold":{c1:"#fb923c",c2:"#431407",glyph:"🦎",subtitle:"CR 1/4"},"preset:hound":{c1:"#38bdf8",c2:"#0c4a6e",glyph:"🐺",subtitle:"CR 1"},"preset:mimic":{c1:"#c084fc",c2:"#3b0764",glyph:"👁",subtitle:"CR 2"},"preset:knight":{c1:"#94a3b8",c2:"#1e293b",glyph:"🛡",subtitle:"CR 3"},"preset:nightmare":{c1:"#e879f9",c2:"#2e1065",glyph:"⚡",subtitle:"CR 5"},"preset:beholder":{c1:"#22d3ee",c2:"#164e63",glyph:"◉",subtitle:"CR 8"},"preset:lich":{c1:"#10b981",c2:"#064e3b",glyph:"☠",subtitle:"CR 13"},"preset:dragon":{c1:"#f43f5e",c2:"#4c0519",glyph:"🐉",subtitle:"CR 17"},"preset:spark":{c1:"#38bdf8",c2:"#1e1b4b",glyph:"✦",subtitle:"AWAKENING"},"preset:crystal":{c1:"#22d3ee",c2:"#0f172a",glyph:"❖",subtitle:"RESOLVE"},"preset:resonance":{c1:"#a855f7",c2:"#2e1065",glyph:"✧",subtitle:"RESONANCE"},"preset:shadowstep":{c1:"#ec4899",c2:"#3b0764",glyph:"☾",subtitle:"DUSK STEP"},"preset:aegis":{c1:"#f59e0b",c2:"#451a03",glyph:"⛨",subtitle:"AEGIS"},"preset:coven":{c1:"#c084fc",c2:"#1e1b4b",glyph:"❂",subtitle:"COVEN LINK"},"preset:eclipse":{c1:"#fb7185",c2:"#4c0519",glyph:"⚔",subtitle:"ECLIPSE"},"preset:crown":{c1:"#fde047",c2:"#581c87",glyph:"♛",subtitle:"ASTRAL CROWN"}};function c(t,s,e,r){const l=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${s}"/>
        <stop offset="55%" stop-color="#0f0f1a"/>
        <stop offset="100%" stop-color="${t}" stop-opacity="0.65"/>
      </linearGradient>
      <radialGradient id="orb" cx="50%" cy="45%" r="45%">
        <stop offset="0%" stop-color="${t}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="${t}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="260" fill="url(#g)"/>
    <circle cx="200" cy="118" r="95" fill="url(#orb)"/>
    <circle cx="200" cy="118" r="64" fill="none" stroke="${t}" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="6 4"/>
    <circle cx="200" cy="118" r="48" fill="none" stroke="${t}" stroke-opacity="0.8" stroke-width="1.5"/>
    <polygon points="200,46 258,150 142,150" fill="none" stroke="${t}" stroke-opacity="0.28" stroke-width="1.2"/>
    <polygon points="200,190 258,86 142,86" fill="none" stroke="${t}" stroke-opacity="0.28" stroke-width="1.2"/>
    <text x="200" y="133" text-anchor="middle" font-size="44" fill="#ffffff" font-family="sans-serif">${e}</text>
    <text x="200" y="226" text-anchor="middle" font-size="11" letter-spacing="4" fill="${t}" font-family="monospace">${r}</text>
  </svg>`;return`data:image/svg+xml;utf8,${encodeURIComponent(l)}`}function i(t,s="✦"){if(!t)return c("#a855f7","#1a1a2e",s,"FRAITH ARCHIVE");if(t.startsWith("http://")||t.startsWith("https://")||t.startsWith("data:"))return t;if(o[t]){const e=o[t];return c(e.c1,e.c2,e.glyph,e.subtitle)}return`/api/r2/${encodeURIComponent(t)}`}export{i as r};
