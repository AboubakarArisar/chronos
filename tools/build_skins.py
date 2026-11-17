"""Writes assets/skins/<id>/{pattern,strip,emblem}.svg and data/skins.json.

Each skin = palette + fonts + native-script motto + tileable panel pattern + border strip
+ emblem motif + fallback music scale. Run: python tools/build_skins.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def svg(w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{rect}{body}</svg>'

# ---------- motifs: (pattern svg, strip svg, emblem svg) ----------
def egypt(c):
    pat = svg(48, 48, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".25"><path d="M24 6c-6 8-6 14 0 20c6-6 6-12 0-20z"/><path d="M24 26v16M16 42h16"/><path d="M8 26c4 0 6 4 6 8M40 26c-4 0-6 4-6 8"/></g>')
    strip = svg(30, 12, f'<rect width="10" height="12" fill="#1f4e8c"/><rect x="10" width="10" height="12" fill="{c["gold"]}"/><rect x="20" width="10" height="12" fill="#9b2f22"/><path d="M15 2l-3 8h6z" fill="#1f4e8c"/>')
    emb = '<path d="M20 4a7 8 0 1 1 0 16a7 8 0 1 1 0-16zM20 20v26M10 26h20" fill="none" stroke="#f3d38a" stroke-width="4"/>'
    return pat, strip, emb

def mesopotamia(c):
    petals = ''.join(f'<ellipse cx="24" cy="15" rx="3" ry="8" transform="rotate({a} 24 24)"/>' for a in range(0, 360, 45))
    pat = svg(48, 48, f'<g fill="{c["line"]}" fill-opacity=".18">{petals}</g><circle cx="24" cy="24" r="3" fill="{c["gold"]}" fill-opacity=".4"/>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#1d4fa0"/><path d="M0 12V9h4V6h4V3h8v3h4v3h4v3z" fill="{c["gold"]}"/>')
    emb = '<g fill="#f3d38a">' + ''.join(f'<ellipse cx="20" cy="14" rx="3" ry="8" transform="rotate({a} 20 24)"/>' for a in range(0, 360, 45)) + '</g><circle cx="20" cy="24" r="4" fill="#1d4fa0"/>'
    return pat, strip, emb

def indus(c):
    pat = svg(40, 40, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".22"><circle cx="0" cy="0" r="20"/><circle cx="40" cy="0" r="20"/><circle cx="0" cy="40" r="20"/><circle cx="40" cy="40" r="20"/><circle cx="20" cy="20" r="20"/></g>')
    strip = svg(20, 12, f'<rect width="20" height="12" fill="#7a3b1c"/><path d="M10 1c5 3 5 8 0 10c-5-2-5-7 0-10z" fill="{c["gold"]}"/>')
    emb = '<path d="M20 6c10 6 10 18 0 26c-10-8-10-20 0-26zM20 32v12" fill="#f3d38a"/>'
    return pat, strip, emb

def china(c):
    pat = svg(40, 40, f'<path d="M4 36V4h32v28H12V12h16v12h-8v-4" fill="none" stroke="{c["line"]}" stroke-opacity=".2" stroke-width="2"/>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#8e1414"/><path d="M1 10V2h10v6H5V5h3M13 10V2h10v6h-6V5h3" fill="none" stroke="{c["gold"]}" stroke-width="1.4"/>')
    emb = '<circle cx="20" cy="22" r="14" fill="none" stroke="#f3d38a" stroke-width="3"/><path d="M12 22c4-8 12-8 16 0c-4 8-12 8-16 0z" fill="#f3d38a"/>'
    return pat, strip, emb

def persia(c):
    pat = svg(48, 48, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".22"><circle cx="24" cy="24" r="10"/>' + ''.join(f'<path d="M24 14q3 5 0 10q-3-5 0-10" transform="rotate({a} 24 24)"/>' for a in range(0, 360, 30)) + '</g>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#22404f"/><path d="M0 12V6h3V3h3V0h4v3h3v3h3v6z" fill="{c["gold"]}"/>')
    emb = '<path d="M4 20h32M20 8l6 12H14z" stroke="#f3d38a" stroke-width="3" fill="#f3d38a"/><circle cx="20" cy="30" r="6" fill="#f3d38a"/>'
    return pat, strip, emb

def greece(c):
    pat = svg(40, 40, f'<path d="M0 36h8V12h16v16h-8v-8" fill="none" stroke="{c["line"]}" stroke-opacity=".2" stroke-width="2"/>')
    strip = svg(20, 12, f'<rect width="20" height="12" fill="#1a1a1a"/><path d="M0 10h4V2h12v6h-6V5h3" fill="none" stroke="#c8693a" stroke-width="1.6"/>')
    emb = '<path d="M8 40c0-16 4-28 12-34c8 6 12 18 12 34" fill="none" stroke="#f3d38a" stroke-width="3"/><path d="M14 40V24M26 40V24" stroke="#f3d38a" stroke-width="2"/>'
    return pat, strip, emb

def rome(c):
    pat = svg(60, 60, f'<path d="M0 30q15-12 30 0t30 0" fill="none" stroke="{c["line"]}" stroke-opacity=".12"/>')
    strip = svg(16, 12, '<rect width="16" height="12" fill="#d9cfbc"/><ellipse cx="8" cy="6" rx="4" ry="4.6" fill="#f3eee4" stroke="#9a8a6c"/><path d="M0 1V11M16 1V11" stroke="#9a8a6c" stroke-width="1.4"/>')
    emb = '<text x="20" y="28" text-anchor="middle" font-family="Cinzel,serif" font-size="13" fill="#f3d38a">SPQR</text>'
    return pat, strip, emb

def india_classical(c):
    pet = ''.join(f'<path d="M24 24q-5-10 0-16q5 6 0 16" transform="rotate({a} 24 24)"/>' for a in range(0, 360, 45))
    pat = svg(48, 48, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".22">{pet}</g>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#6b1d3a"/><circle cx="8" cy="6" r="3.5" fill="{c["gold"]}"/><path d="M0 6h4M12 6h4" stroke="{c["gold"]}"/>')
    emb = '<g fill="#f3d38a">' + ''.join(f'<path d="M20 24q-5-10 0-16q5 6 0 16" transform="rotate({a} 20 24)"/>' for a in range(0, 360, 45)) + '</g>'
    return pat, strip, emb

def byzantine(c):
    pat = svg(12, 12, f'<rect x="1" y="1" width="10" height="10" fill="{c["gold"]}" fill-opacity=".09"/>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#4a1a5c"/><circle cx="6" cy="6" r="4.5" fill="none" stroke="{c["gold"]}" stroke-width="1.4"/><circle cx="18" cy="6" r="4.5" fill="none" stroke="{c["gold"]}" stroke-width="1.4"/><path d="M10.5 6h3" stroke="{c["gold"]}"/>')
    emb = '<path d="M20 6v36M8 18h24" stroke="#f3d38a" stroke-width="4"/><circle cx="20" cy="18" r="13" fill="none" stroke="#f3d38a" stroke-width="2"/>'
    return pat, strip, emb

def islamic(c):
    pat = svg(44, 44, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".22"><rect x="12" y="12" width="20" height="20"/><rect x="12" y="12" width="20" height="20" transform="rotate(45 22 22)"/><path d="M0 0L8 8M44 0L36 8M0 44L8 36M44 44L36 36"/></g><circle cx="22" cy="22" r="3" fill="#3fb8af" fill-opacity=".3"/>')
    strip = svg(14, 12, f'<rect width="14" height="12" fill="#137a78"/><path d="M7 1L9 4L13 4L10 6.5L11 10.5L7 8.3L3 10.5L4 6.5L1 4L5 4Z" fill="{c["gold"]}"/>')
    emb = '<g fill="none" stroke="#f2d27e" stroke-width="2.5"><rect x="10" y="14" width="20" height="20"/><rect x="10" y="14" width="20" height="20" transform="rotate(45 20 24)"/></g>'
    return pat, strip, emb

def norse(c):
    pat = svg(40, 40, f'<path d="M0 20q10-16 20 0t20 0M0 20q10 16 20 0t20 0" fill="none" stroke="{c["line"]}" stroke-opacity=".18" stroke-width="2"/>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#2b2016"/><path d="M0 9q4-8 8 0t8 0M0 3q4 8 8 0t8 0" fill="none" stroke="{c["gold"]}" stroke-width="1.3"/>')
    emb = '<path d="M10 8l20 32M30 8L10 40M20 4v40" stroke="#f3d38a" stroke-width="3"/>'
    return pat, strip, emb

def medieval_europe(c):
    fl = 'M12 4c-3 4-3 8 0 10c3-2 3-6 0-10zM12 14c-4 0-7-2-8-5c3 0 6 1 8 5zM12 14c4 0 7-2 8-5c-3 0-6 1-8 5zM8 16h8'
    pat = svg(48, 48, f'<g fill="{c["line"]}" fill-opacity=".14"><path d="{fl}"/><path d="{fl}" transform="translate(24 24)"/></g>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#1e2f6a"/><g fill="{c["gold"]}"><circle cx="8" cy="3.5" r="2.4"/><circle cx="8" cy="8.5" r="2.4"/><circle cx="5.5" cy="6" r="2.4"/><circle cx="10.5" cy="6" r="2.4"/></g>')
    emb = f'<path d="{fl}" transform="translate(8 8) scale(1.3)" fill="#f3d38a"/>'
    return pat, strip, emb

def mongol(c):
    pat = svg(300, 300, '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .38 0 0 0 0 .22 0 0 0 .32 0"/></filter><rect width="300" height="300" filter="url(#n)"/>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#1d4f8a"/><path d="M0 10H5V2H15V8H10V5" fill="none" stroke="{c["gold"]}" stroke-width="1.6"/><path d="M15 10H24" stroke="{c["gold"]}" stroke-width="1.6"/>')
    emb = '<circle cx="20" cy="9" r="5" fill="#f6dc94"/><path d="M8 18a12 12 0 0 0 24 0a12 9 0 0 1-24 0z" fill="#f6dc94"/><rect x="8" y="30" width="24" height="4" fill="#f6dc94"/><path d="M20 38l10 8H10z" fill="#f6dc94"/>'
    return pat, strip, emb

def africa(c):
    pat = svg(32, 32, f'<g fill="{c["line"]}" fill-opacity=".16"><path d="M0 0h16L8 10z"/><path d="M16 16h16l-8 10z"/></g><path d="M0 28h32" stroke="{c["line"]}" stroke-opacity=".16"/>')
    strip = svg(24, 12, f'<rect width="8" height="12" fill="#c8961e"/><rect x="8" width="8" height="12" fill="#1f6b3a"/><rect x="16" width="8" height="12" fill="#9b2f22"/><path d="M0 6h24" stroke="#000" stroke-opacity=".5"/>')
    emb = '<path d="M20 6l12 18l-12 18l-12-18z" fill="none" stroke="#f3d38a" stroke-width="3"/><circle cx="20" cy="24" r="4" fill="#f3d38a"/>'
    return pat, strip, emb

def mesoamerica(c):
    pat = svg(40, 40, f'<path d="M0 38h12V26h8v6h-4M20 2h12v12h8" fill="none" stroke="{c["line"]}" stroke-opacity=".22" stroke-width="2"/>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#2f6b5c"/><path d="M0 11h6V7h4V3h4v4h-3M12 11h6V7h4" fill="none" stroke="{c["gold"]}" stroke-width="1.6"/>')
    emb = '<path d="M20 6l14 14l-14 14L6 20z" fill="none" stroke="#f3d38a" stroke-width="3"/><path d="M20 14l6 6l-6 6l-6-6z" fill="#f3d38a"/>'
    return pat, strip, emb

def andes(c):
    pat = svg(32, 32, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".22"><rect x="2" y="2" width="12" height="12"/><path d="M18 18h12v12H18zM22 22h4v4h-4z"/><path d="M2 18l6 6l6-6M18 2l6 6l6-6"/></g>')
    strip = svg(12, 12, f'<rect width="12" height="12" fill="#8e2a1e"/><path d="M6 1l5 5l-5 5l-5-5z" fill="{c["gold"]}"/><rect x="5" y="5" width="2" height="2" fill="#8e2a1e"/>')
    emb = '<circle cx="20" cy="22" r="9" fill="#f3d38a"/>' + ''.join(f'<path d="M20 4v6" stroke="#f3d38a" stroke-width="3" transform="rotate({a} 20 22)"/>' for a in range(0, 360, 30))
    return pat, strip, emb

def japan(c):
    arcs = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y in [(0, 20), (40, 20), (20, 40), (20, 0)] for r in (18, 13, 8))
    pat = svg(40, 40, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".16">{arcs}</g>')
    strip = svg(12, 12, f'<rect width="12" height="12" fill="#1b2a3a"/><path d="M6 0v12M0 6h12M0 0l12 12M12 0L0 12" stroke="{c["gold"]}" stroke-width=".9"/>')
    emb = '<circle cx="20" cy="22" r="12" fill="#c8281e"/>'
    return pat, strip, emb

def ottoman(c):
    pat = svg(48, 48, f'<g fill="{c["line"]}" fill-opacity=".18"><circle cx="12" cy="10" r="4"/><circle cx="20" cy="10" r="4"/><circle cx="16" cy="17" r="4"/></g><path d="M28 34q4-4 8 0t8 0M28 40q4-4 8 0t8 0" fill="none" stroke="{c["line"]}" stroke-opacity=".18"/>')
    strip = svg(14, 12, f'<rect width="14" height="12" fill="#1c4a78"/><path d="M7 11c-3-2-4-5-3-8c1 1 2 2 3 2c1 0 2-1 3-2c1 3 0 6-3 8z" fill="#c8281e"/><path d="M7 11v1" stroke="{c["gold"]}"/>')
    emb = '<path d="M26 10a12 12 0 1 0 0 24a10 10 0 1 1 0-24z" fill="#f3d38a"/><path d="M30 18l1.8 4.5l4.7.2l-3.7 3l1.3 4.6l-4.1-2.7l-4 2.7l1.3-4.6l-3.7-3l4.7-.2z" fill="#f3d38a"/>'
    return pat, strip, emb

def mughal(c):
    pat = svg(40, 40, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".2"><path d="M20 0l20 20l-20 20L0 20z"/><circle cx="20" cy="20" r="6"/><path d="M20 14v12M14 20h12"/></g>')
    strip = svg(24, 12, f'<rect width="24" height="12" fill="#f1ece0"/><path d="M0 8q6-8 12 0t12 0" fill="none" stroke="#2f6b3a" stroke-width="1.2"/><circle cx="6" cy="4" r="2" fill="#b8282e"/><circle cx="18" cy="8" r="2" fill="#c8961e"/>')
    emb = '<path d="M20 6c6 6 10 10 10 18a10 10 0 0 1-20 0c0-8 4-12 10-18z" fill="none" stroke="#f3d38a" stroke-width="3"/><path d="M20 4v6" stroke="#f3d38a" stroke-width="2"/>'
    return pat, strip, emb

def exploration(c):
    rays = ''.join(f'<path d="M50 50L{50+60*__import__("math").cos(a*0.3927):.1f} {50+60*__import__("math").sin(a*0.3927):.1f}"/>' for a in range(16))
    pat = svg(100, 100, f'<g stroke="{c["line"]}" stroke-opacity=".12" fill="none">{rays}<circle cx="50" cy="50" r="10"/></g>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#2a2216"/><path d="M0 9q4-6 8-3t8-3" fill="none" stroke="{c["gold"]}" stroke-width="2"/><path d="M0 3q4 6 8 3t8 3" fill="none" stroke="#8a6a3a" stroke-width="2"/>')
    emb = '<path d="M20 4l4 16l16 4l-16 4l-4 16l-4-16l-16-4l16-4z" fill="#f3d38a"/>'
    return pat, strip, emb

def revolution(c):
    pat = svg(36, 36, f'<g fill="none" stroke="{c["line"]}" stroke-opacity=".14"><path d="M18 2c8 6 8 10 0 16c-8-6-8-10 0-16zM18 18c8 6 8 10 0 16c-8-6-8-10 0-16z"/><path d="M0 18h36"/></g>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#1f2a44"/><path d="M2 10c2-6 6-8 12-8M5 8l-2-3M9 5l-1-3" fill="none" stroke="{c["gold"]}" stroke-width="1.2"/>')
    emb = '<path d="M8 40c0-14 6-26 12-30c6 4 12 16 12 30" fill="none" stroke="#f3d38a" stroke-width="2"/><path d="M14 18l-5-3M13 26l-6-2M26 18l5-3M27 26l6-2" stroke="#f3d38a" stroke-width="2"/>'
    return pat, strip, emb

def worldwars(c):
    pat = svg(40, 40, f'<path d="M0 30l20-20l20 20M0 40l20-20l20 20" fill="none" stroke="{c["line"]}" stroke-opacity=".12" stroke-width="2"/>')
    strip = svg(12, 12, f'<rect width="12" height="12" fill="#2b2b26"/><path d="M0 10l6-6l6 6" fill="none" stroke="{c["gold"]}" stroke-width="1.6"/>')
    emb = '<path d="M20 6l4 10h10l-8 6l3 10l-9-6l-9 6l3-10l-8-6h10z" fill="#f3d38a"/>'
    return pat, strip, emb

def modern(c):
    pat = svg(40, 40, f'<path d="M0 .5h40M.5 0v40" stroke="{c["line"]}" stroke-opacity=".08"/>')
    strip = svg(12, 12, f'<rect width="12" height="12" fill="#1f1f1f"/><path d="M0 6h12" stroke="{c["gold"]}" stroke-opacity=".7"/>')
    emb = '<circle cx="20" cy="24" r="13" fill="none" stroke="#e8e8e8" stroke-width="2"/><path d="M7 24h26M20 11c-6 6-6 20 0 26c6-6 6-20 0-26" fill="none" stroke="#e8e8e8" stroke-width="1.5"/>'
    return pat, strip, emb

def prehistory(c):
    pat = svg(48, 48, f'<g fill="{c["line"]}" fill-opacity=".16"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="34" cy="30" r="2"/><circle cx="40" cy="36" r="2"/></g><path d="M4 40l10-6l8 4" stroke="{c["line"]}" stroke-opacity=".16" fill="none" stroke-width="2"/>')
    strip = svg(16, 12, f'<rect width="16" height="12" fill="#5a2e1a"/><circle cx="4" cy="6" r="1.6" fill="{c["gold"]}"/><path d="M8 3v6M11 3v6" stroke="{c["gold"]}" stroke-width="1.4"/>')
    emb = '<path d="M20 44V26M12 30c0-10 4-18 8-22c4 4 8 12 8 22c-4 2-12 2-16 0z" fill="#d9a46a"/>'
    return pat, strip, emb

# ---------- skin table ----------
# panel, ink, ink2, hi, accent, metal (gold) stops, fonts (Google Fonts families), motto (native script), music
S = [
 ("egypt","Ancient Egypt","#1b2433","#f1e6c8","#c9b98e","#f2c75c","#2f7fb8",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Marcellus SC","Cormorant Garamond","Noto Sans Egyptian Hieroglyphs","𓋹𓍑𓋴","ankh, wedja, seneb: life, prosperity, health","papyrus and lapis, gold leaf, blue-gold-red collar bands",[0,1,4,5,7,8],"harp"),
 ("mesopotamia","Mesopotamia","#141c33","#efe4c6","#bfb08a","#f0c860","#2f62c4",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Cinzel","EB Garamond","Noto Sans Cuneiform","𒀭𒈗","dingir lugal: divine king","glazed lapis brick like the Ishtar Gate, gold rosettes, clay tablets",[0,2,3,5,7,8,10],"lyre"),
 ("indus","Indus and Vedic India","#2a1a10","#f2e3c6","#c8ad86","#e9b35a","#b8562a",["#6e4018","#e8c38a","#8c5a26","#f6dcae"],"Cormorant SC","Spectral","Tiro Devanagari Sanskrit","ऋग्वेद","Rigveda","terracotta, carved steatite seals, burnt-brick red",[0,1,4,5,7,8,11],"drone"),
 ("china","Chinese dynasties","#1a0c0c","#f6e9cf","#d1b48c","#f2c75c","#c8281e",["#6e3a10","#f6d084","#9c5a1a","#fbe2a0"],"Cormorant SC","Noto Serif SC","Ma Shan Zheng","天命","Tianming, the Mandate of Heaven","red lacquer and black, gold fret borders, ink-brush titles, red seal stamps",[0,2,4,7,9],"pluck"),
 ("persia","Persian empires","#132630","#f1e6cc","#b9c2b0","#e9c46a","#2a8a8a",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Cinzel","Cormorant Garamond","Noto Sans Old Persian","𐎧𐏁𐎠𐎹𐎰𐎡𐎹","xšāyaθiya: king","Persepolis limestone reliefs, turquoise, gold rosettes, stepped merlons",[0,1,4,5,7,8,10],"pluck"),
 ("greece","Greece and the Hellenistic world","#1c1612","#f3e8d4","#c9b394","#e0884a","#c8693a",["#5a3a14","#e8b07a","#7b5220","#f6d0a0"],"Cinzel","GFS Didot","GFS Didot","ΕΛΛΑΣ","Hellas","black-figure pottery: terracotta on black, meander borders, white marble",[0,2,3,5,7,9,10],"lyre"),
 ("rome","Rome","#e9e2d4","#2b241d","#6b5a44","#7c1717","#8e1b1b",["#5a3a14","#d9a75a","#7b5220","#f0c98a"],"Cinzel","Cormorant Garamond","Cinzel","SENATVS POPVLVSQVE ROMANVS","the Senate and People of Rome","veined white marble, imperial red, bronze, carved capitals, egg-and-dart",[0,2,4,5,7,9,11],"brass"),
 ("india_classical","Classical India","#2a0f1e","#f6e6d0","#d0b090","#f2c060","#d4507a",["#6e4018","#f6d08a","#9c6426","#fbe2ae"],"Cormorant SC","Spectral","Tiro Devanagari Hindi","सत्यमेव जयते","truth alone triumphs (Mundaka Upanishad)","sandstone temple carving, saffron and maroon, gold lotus, Ajanta fresco colours",[0,1,4,5,7,8,11],"drone"),
 ("byzantine","Byzantium","#1f0f2a","#f3e6c6","#c9b28a","#f2cf6a","#7a3a9a",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Cinzel Decorative","EB Garamond","GFS Didot","ΒΑΣΙΛΕΙΑ ΤΩΝ ΡΩΜΑΙΩΝ","Empire of the Romans","gold mosaic tesserae, imperial purple, icons, enamel",[0,2,3,5,7,8,10],"choir"),
 ("islamic","Islamic caliphates and sultanates","#0c2a35","#f3ead2","#b9cfc6","#f2d27e","#3fb8af",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Marcellus SC","Amiri","Amiri","بيت الحكمة","Bayt al-Hikma, the House of Wisdom","geometric star tilework, lapis and turquoise, gold calligraphy, pointed arches",[0,1,4,5,7,8,10],"oud"),
 ("norse","Norse and Vikings","#1d1812","#ece2cc","#b8a888","#d9b26a","#7a8a6a",["#4a4a4a","#d8d8d8","#6a6a6a","#f2f2f2"],"Metamorphous","Alegreya","Noto Sans Runic","ᚠᚢᚦᚨᚱᚲ","the futhark","carved oak, iron fittings, knotwork, runestones",[0,2,3,5,7,8,10],"drone"),
 ("medieval_europe","Medieval Europe","#181a2a","#f2e8d0","#c4b48e","#e9c35a","#3a5ab8",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"UnifrakturCook","IM Fell English","IM Fell English SC","Anno Domini","in the year of the Lord","illuminated manuscript: gold leaf, ultramarine, vermilion, vellum, heraldry",[0,2,3,5,7,9,10],"choir"),
 ("mongol","Steppe empires","#1b120b","#f1e4c6","#cdb48a","#f6dc94","#4d8fd6",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Alegreya SC","Alegreya","Noto Sans Mongolian","ᠶᠡᠬᠡ ᠮᠣᠩᠭᠣᠯ ᠤᠯᠤᠰ","Yeke Mongγol Ulus, the Great Mongol State","felt and leather, eternal-sky blue, gold, key-pattern borders",[0,2,5,7,9],"bowed"),
 ("africa","African kingdoms","#1e140a","#f4e6c8","#cdb08a","#f2c040","#1f8a4a",["#6e4a10","#f6d070","#9c6a1a","#fbe6a0"],"Josefin Sans","Alegreya","Noto Sans Ethiopic","ኢትዮጵያ","Ityop'iya","gold of Mali, kente stripes, mud-cloth triangles, bronze",[0,2,4,7,9],"kora"),
 ("mesoamerica","Mesoamerica","#0f2622","#f0e6cc","#b8c4a8","#e9c35a","#2fa08a",["#3a5a3a","#d8e0a8","#5a7a4a","#f0f0c0"],"Metamorphous","Spectral","Metamorphous","Huēyi Tlahtōlōyān","the great speaker's realm","carved limestone, jade green, turquoise mosaic, stepped frets",[0,2,4,7,9],"flute"),
 ("andes","Andean civilizations","#2a1210","#f4e4c8","#d2a888","#f2b84a","#c84a2e",["#6e4018","#f6c870","#9c5a1a","#fbe0a0"],"Josefin Slab","Spectral","Josefin Slab","Tawantinsuyu","the four parts together","tocapu textile squares, Inca gold, terracotta and red wool",[0,3,5,7,10],"flute"),
 ("japan","Japan","#141a22","#f2ebe0","#c4bcae","#e9c35a","#c8281e",["#4a4a4a","#e8d8a8","#6a6a6a","#f6ecc8"],"Shippori Mincho","Shippori Mincho","Yuji Syuku","天下泰平","peace under heaven","gold-leaf folding screens, washi paper, lacquer, seigaiha waves",[0,1,5,7,8],"koto"),
 ("ottoman","Ottoman Empire","#10233a","#f3ead6","#b9c6d0","#f2cf6a","#c8281e",["#6e5018","#f6dc94","#9c7426","#fbe7a8"],"Marcellus SC","Amiri","Amiri","دولت عليه عثمانیه","the Sublime Ottoman State","Iznik tiles: cobalt, turquoise, tomato red, tulips, çintamani",[0,1,4,5,7,8,10],"oud"),
 ("mughal","Mughal Empire","#f1ece0","#2a2018","#6a5a44","#8a5a14","#2f6b3a",["#6e5018","#e8c070","#8c6420","#f6dca0"],"Cormorant SC","Cormorant Garamond","Noto Nastaliq Urdu","سلطنتِ مغلیہ","the Mughal Sultanate","white marble with pietra dura inlay, jali screens, miniature-painting colours",[0,1,4,5,7,8,11],"sitar"),
 ("exploration","Age of Exploration","#efe4cc","#2a2216","#6a5a40","#8a3a14","#1f4e7a",["#5a3a14","#c8a060","#7b5220","#e8c890"],"IM Fell English SC","IM Fell English","IM Fell English SC","Plus Ultra","further beyond","portolan charts: aged vellum, rhumb lines, compass roses, sealing wax",[0,2,4,5,7,9,11],"lute"),
 ("revolution","Revolutions and empires","#1a1f2e","#efe8d8","#b8b2a0","#d9b45a","#9a2a2a",["#5a5a5a","#e8e0c8","#7a7a6a","#fbf4dc"],"Playfair Display SC","Libre Baskerville","Playfair Display","Liberté, égalité, fraternité","liberty, equality, fraternity","engraved banknotes, oil painting gilt frames, brass and mahogany",[0,2,4,5,7,9,11],"piano"),
 ("worldwars","The World Wars","#22241f","#ece6d4","#b4ae98","#d9c27a","#8a2a1e",["#3a3a32","#c8c0a0","#5a5a4a","#e8e0c0"],"Limelight","Special Elite","Special Elite","","","Art Deco posters, field maps, typewritten dispatches, khaki and brass",[0,2,3,5,7,8,10],"piano"),
 ("modern","The modern world","#181818","#ededed","#a8a8a8","#f2f2f2","#4a8ad8",["#5a5a5a","#e8e8e8","#7a7a7a","#ffffff"],"Manrope","Manrope","Manrope","","","clean glass panels, thin lines, satellite imagery",[0,2,4,7,9],"pad"),
 ("prehistory","Before history","#20140c","#efe0c8","#c0a480","#e0904a","#b85a2a",["#5a3a1a","#d8a870","#7a4a20","#f0c890"],"Metamorphous","Spectral","Metamorphous","","","cave walls, ochre handprints, charcoal, bone and stone",[0,3,5,7,10],"flute"),
]
MOTIF = {k: v for k, v in globals().items() if callable(v) and k in {s[0] for s in S}}

out = {"note": "Culture skin specs. Fonts are Google Fonts family names. 'metal' = 4 gradient stops for frames and studs. 'scale' = semitones for the procedural music fallback, 'timbre' = suggested synth voice. Assets in assets/skins/<id>/.", "skins": {}}
for (sid, name, panel, ink, ink2, hi, accent, metal, head, body, deco, motto, motto_en, materials, scale, timbre) in S:
    d = os.path.join(ROOT, "assets", "skins", sid); os.makedirs(d, exist_ok=True)
    c = {"line": ink, "gold": metal[1]}
    pat, strip, emb = MOTIF[sid](c)
    open(os.path.join(d, "pattern.svg"), "w", encoding="utf-8").write(pat)
    open(os.path.join(d, "strip.svg"), "w", encoding="utf-8").write(strip)
    open(os.path.join(d, "emblem.svg"), "w", encoding="utf-8").write(svg(40, 54, emb))
    light = int(panel[1:3], 16) > 128
    out["skins"][sid] = {"name": name, "panel": panel, "panel_is_light": light, "ink": ink, "ink2": ink2, "hi": hi, "accent": accent,
        "metal": metal, "fonts": {"head": head, "body": body, "deco": deco}, "motto": motto, "motto_en": motto_en,
        "materials": materials, "scale": scale, "timbre": timbre,
        "assets": {"pattern": f"assets/skins/{sid}/pattern.svg", "strip": f"assets/skins/{sid}/strip.svg", "emblem": f"assets/skins/{sid}/emblem.svg"}}
json.dump(out, open(os.path.join(ROOT, "data", "skins.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out["skins"]), "skins written")
