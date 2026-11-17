// One colour per ruling power (SUBJECTO), stable across all years.
const PAL = ['#8a5a7a', '#3f7a6a', '#7a6a3a', '#3f5f9a', '#a86b4a', '#5d7a3a', '#7d3a8f', '#4f8a8b', '#9a5540', '#6a6a8a', '#8a7a4a', '#5a7a8a',
  '#7b4b5e', '#4a7350', '#96703c', '#52669e', '#8f5a3c', '#6b8046', '#6d4a8c', '#3d7f86', '#a0584e', '#75708f', '#9a8448', '#4f7f9a'];
// Fixed colours for major powers so they read the same in every year.
const FIXED = [
  [/Roman|^Rome/i, '#a8282a'], [/Mongol|Golden Horde|Ilkhan|Chagatai|Great Khan|Yuan/i, '#d9a43a'], [/Abbasid|Umayyad|Rashidun|Caliphate/i, '#1f8a84'],
  [/^Han$|^Han |Tang|Song|Ming|Qing|Manchu|^China|Sui|^Qin$|Zhou|Shang|^Jin$|People's Republic of China/i, '#b8443a'],
  [/Ottoman/i, '#2f7d4f'], [/Byzant|Eastern Roman/i, '#7d3a8f'], [/Achaemenid|Persia|Parthia|Sasan|Safavid|^Iran/i, '#7d5ba6'],
  [/Egypt|Ptolem/i, '#c8a04a'], [/Macedon|Alexander|Seleucid/i, '#4f7fb8'], [/Maurya|Gupta/i, '#b07a2a'], [/Mughal/i, '#5d8a3a'], [/Delhi/i, '#5d7a3a'],
  [/United Kingdom|^UK$|Brit|^England|Great Britain/i, '#b5485f'], [/^France|French|Frank|Carolingian/i, '#3d5fa8'], [/^Spain|Spanish|Castil/i, '#c9a227'],
  [/Portug/i, '#2e8b57'], [/Netherlands|Dutch/i, '#d97a2a'], [/USSR|Soviet/i, '#a03a2c'], [/Russia|Muscov|Kievan|Novgorod/i, '#6b8e4e'],
  [/United States|^USA$/i, '#4a6fa5'], [/German|Prussia|Holy Roman/i, '#6f7480'], [/Austria|Habsburg/i, '#b8a23a'], [/Japan/i, '#c05a6a'],
  [/Inca|Tawantinsuyu/i, '#b8562a'], [/Aztec|Mexica/i, '#2fa08a'], [/Maya/i, '#3f8a5a'], [/Mali|Songhai|Ghana/i, '#c79a2a'], [/Ethiopia|Aksum|Axum/i, '#8a6a2a'],
  [/Kushan/i, '#3f7a6a'], [/Carthag/i, '#7a4a9a'], [/Greek|Athens|Sparta/i, '#4f8fb8'], [/Italy/i, '#4f9a6a'], [/Belgi/i, '#a08a3a'], [/Denmark|Danes|Norw|Swed/i, '#5a7a9a'],
  [/Khmer|Angkor/i, '#8a5a3a'], [/Timurid/i, '#b0803a'], [/Mamluk|Mameluk|Ayyubid|Fatimid/i, '#a86b4a'], [/Seljuk/i, '#3d8f9a'], [/Hun/i, '#8a7a4a']
];
const cache = new Map();
export function colorFor(key) {
  let c = cache.get(key); if (c) return c;
  for (const [re, col] of FIXED) if (re.test(key)) { c = col; break; }
  if (!c) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; c = PAL[Math.abs(h) % PAL.length]; }
  cache.set(key, c); return c;
}
export const hexToRgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const COLONIAL = /United Kingdom|^UK$|Brit|^England|^France|^Spain|Spanish|Portug|Netherlands|Dutch|Belgi|^German|^Italy|Denmark|^Russia|United States|^USA$|Japan/i;
// A colony: ruled from elsewhere by a colonial power, from the Age of Exploration on.
export const isColony = (year, name, subj) => year >= 1450 && subj !== name && COLONIAL.test(subj) && !name.includes(subj) && !subj.includes(name);
