// ============================================================
// Shared mojibake (double-encoded UTF-8) detector.
// Reverses CP1252-decoded-then-reencoded UTF-8 back to the
// original character(s) so callers can flag pages that still
// contain artifacts like "â€¦" (should be "…") or "ðŸ”’" (should be "🔒").
// ============================================================

const CP1252 = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};
const CP1252_REVERSE = {};
for (const [byte, cp] of Object.entries(CP1252)) CP1252_REVERSE[cp] = parseInt(byte);

function charToByte(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x80) return null;
  if (cp >= 0xA0 && cp <= 0xFF) return cp;
  if (CP1252_REVERSE[cp] !== undefined) return CP1252_REVERSE[cp];
  return null;
}

// Returns [{ original, fixed }] for every mojibake run found in text.
function findMojibake(text) {
  const found = [];
  let i = 0;
  while (i < text.length) {
    const firstByte = charToByte(text[i]);
    if (firstByte === null) { i++; continue; }

    let j = i;
    const chars = [];
    const bytes = [];
    while (j < text.length) {
      const b = charToByte(text[j]);
      if (b === null) break;
      bytes.push(b);
      chars.push(text[j]);
      j++;
    }

    let consumed = 0;
    if (bytes.length >= 2) {
      for (let len = bytes.length; len >= 2; len--) {
        const buf = Buffer.from(bytes.slice(0, len));
        const decoded = buf.toString('utf8');
        if (!decoded.includes('�') && Buffer.from(decoded, 'utf8').equals(buf) && decoded !== chars.slice(0, len).join('')) {
          found.push({ original: chars.slice(0, len).join(''), fixed: decoded });
          consumed = len;
          break;
        }
      }
    }
    i += consumed > 0 ? consumed : 1;
  }
  return found;
}

module.exports = { findMojibake };
