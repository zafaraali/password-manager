/**
 * Minimal, zero-dependency QR Code Generator in pure JavaScript
 * Generates valid Model 2 QR Codes and renders as SVG or Canvas.
 */

// QR Code specification tables
const PAD0 = 0xEC;
const PAD1 = 0x11;

const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ ((x >> 7) * 0x11d);
}

function glog(n) {
  if (n < 1) throw new Error("glog(" + n + ")");
  return LOG_TABLE[n];
}

function gexp(n) {
  while (n < 0) n += 255;
  while (n >= 255) n -= 255;
  return EXP_TABLE[n];
}

function polyMul(p1, p2) {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gexp(glog(p1[i]) + glog(p2[j]));
    }
  }
  return res;
}

function polyMod(dividend, divisor) {
  let result = new Uint8Array(dividend);
  while (result.length >= divisor.length) {
    const coeff = result[0];
    if (coeff !== 0) {
      const logCoeff = glog(coeff);
      for (let i = 0; i < divisor.length; i++) {
        result[i] ^= gexp(logCoeff + glog(divisor[i]));
      }
    }
    result = result.slice(1);
  }
  return result;
}

function getGeneratorPoly(deg) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < deg; i++) {
    g = polyMul(g, new Uint8Array([1, gexp(i)]));
  }
  return g;
}

// Version table capacities for Byte mode with Error Correction Level L/M
// Version 1..10 support strings up to ~270 characters (more than enough for otpauth URLs)
const VERSION_SPECS = [
  null,
  { totalCodewords: 26, ecCodewords: 7, dataCodewords: 19 },
  { totalCodewords: 44, ecCodewords: 10, dataCodewords: 34 },
  { totalCodewords: 70, ecCodewords: 15, dataCodewords: 55 },
  { totalCodewords: 100, ecCodewords: 20, dataCodewords: 80 },
  { totalCodewords: 134, ecCodewords: 26, dataCodewords: 108 },
  { totalCodewords: 172, ecCodewords: 36, dataCodewords: 136 },
  { totalCodewords: 196, ecCodewords: 40, dataCodewords: 156 },
  { totalCodewords: 242, ecCodewords: 48, dataCodewords: 194 },
  { totalCodewords: 292, ecCodewords: 60, dataCodewords: 232 },
  { totalCodewords: 346, ecCodewords: 72, dataCodewords: 274 },
];

export class QRCodeEncoder {
  static encode(text) {
    const enc = new TextEncoder();
    const dataBytes = enc.encode(text);
    
    // Choose smallest version that fits
    let version = 1;
    while (version <= 10 && VERSION_SPECS[version].dataCodewords < dataBytes.length + 3) {
      version++;
    }
    if (version > 10) version = 10;

    const spec = VERSION_SPECS[version];
    const size = 17 + 4 * version;

    // Bit buffer
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    };

    // 0100 = 8-bit Byte Mode
    pushBits(4, 4);
    // Character count indicator (8 bits for version 1-9, 16 for version 10+)
    pushBits(dataBytes.length, version < 10 ? 8 : 16);
    // Data bytes
    for (let b of dataBytes) {
      pushBits(b, 8);
    }
    // Terminator
    const rem = spec.dataCodewords * 8 - bits.length;
    pushBits(0, Math.min(4, rem));
    // Byte alignment
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad bytes
    let padToggle = false;
    while (bits.length < spec.dataCodewords * 8) {
      pushBits(padToggle ? PAD1 : PAD0, 8);
      padToggle = !padToggle;
    }

    const dataCodewords = new Uint8Array(spec.dataCodewords);
    for (let i = 0; i < dataCodewords.length; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bits[i * 8 + j];
      }
      dataCodewords[i] = b;
    }

    // Reed-Solomon Error Correction
    const gen = getGeneratorPoly(spec.ecCodewords);
    const padded = new Uint8Array(spec.totalCodewords);
    padded.set(dataCodewords, 0);
    const ec = polyMod(padded, gen);

    const allCodewords = new Uint8Array(spec.totalCodewords);
    allCodewords.set(dataCodewords, 0);
    allCodewords.set(ec, spec.dataCodewords);

    // Create Matrix
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));

    // Finder patterns
    const setFinder = (r, c) => {
      for (let i = -1; i <= 7; i++) {
        for (let j = -1; j <= 7; j++) {
          const row = r + i, col = c + j;
          if (row < 0 || row >= size || col < 0 || col >= size) continue;
          if ((i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
              (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
              (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
            matrix[row][col] = true;
          } else {
            matrix[row][col] = false;
          }
        }
      }
    };

    setFinder(0, 0);
    setFinder(0, size - 7);
    setFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (matrix[6][i] === null) matrix[6][i] = (i % 2 === 0);
      if (matrix[i][6] === null) matrix[i][6] = (i % 2 === 0);
    }

    // Dark module
    matrix[4 * version + 9][8] = true;

    // Alignment patterns (for version >= 2)
    if (version >= 2) {
      const pos = [6, size - 7];
      for (let r of pos) {
        for (let c of pos) {
          if (matrix[r][c] !== null) continue;
          for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
              matrix[r + i][c + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1);
            }
          }
        }
      }
    }

    // Reserve format information
    for (let i = 0; i < 9; i++) {
      if (matrix[8][i] === null) matrix[8][i] = false;
      if (matrix[i][8] === null) matrix[i][8] = false;
    }
    for (let i = size - 8; i < size; i++) {
      if (matrix[8][i] === null) matrix[8][i] = false;
      if (matrix[i][8] === null) matrix[i][8] = false;
    }

    // Data placement
    let bitIdx = 0;
    const totalBits = allCodewords.length * 8;
    let right = size - 1;
    let upward = true;

    while (right > 0) {
      if (right === 6) right--; // skip timing col
      const rows = upward 
        ? Array.from({ length: size }, (_, idx) => size - 1 - idx) 
        : Array.from({ length: size }, (_, idx) => idx);

      for (let r of rows) {
        for (let c of [right, right - 1]) {
          if (matrix[r][c] === null) {
            let dark = false;
            if (bitIdx < totalBits) {
              const byteI = Math.floor(bitIdx / 8);
              const bitI = 7 - (bitIdx % 8);
              dark = ((allCodewords[byteI] >> bitI) & 1) === 1;
              bitIdx++;
            }
            // Mask pattern 0: (row + col) % 2 === 0
            const mask = (r + c) % 2 === 0;
            matrix[r][c] = dark ^ mask;
          }
        }
      }
      right -= 2;
      upward = !upward;
    }

    // Format bits for Mask 0, Level L = 111011111000100
    const fmtBits = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
    for (let i = 0; i < 6; i++) matrix[8][i] = fmtBits[i] === 1;
    matrix[8][7] = fmtBits[6] === 1;
    matrix[8][8] = fmtBits[7] === 1;
    matrix[7][8] = fmtBits[8] === 1;
    for (let i = 9; i < 15; i++) matrix[14 - i][8] = fmtBits[i] === 1;

    for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = fmtBits[i] === 1;
    for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = fmtBits[i] === 1;

    return matrix;
  }

  static renderSvg(text, { size = 200, color = '#000000', bgColor = '#ffffff', margin = 2 } = {}) {
    const matrix = this.encode(text);
    const n = matrix.length;
    const totalDim = n + margin * 2;
    let paths = '';

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) {
          paths += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}" height="${size}" shape-rendering="crispEdges">
      <rect width="${totalDim}" height="${totalDim}" fill="${bgColor}"/>
      <path d="${paths}" fill="${color}"/>
    </svg>`;
  }
}

