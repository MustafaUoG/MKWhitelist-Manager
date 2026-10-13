const GRID_SIZE = 8;

// Draws a blocky, mirrored pattern that is always the same for the same seed, so every account
// gets its own recognisable picture without the app having to look anything up online
export function drawAvatar(canvas, seed) {
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;

  const random = createRandom(hash(seed));
  const hue = Math.floor(random() * 360);
  const context = canvas.getContext('2d');

  context.fillStyle = `hsl(${hue} 35% 28%)`;
  context.fillRect(0, 0, GRID_SIZE, GRID_SIZE);

  for (let y = 0; y < GRID_SIZE; y++) {
    // Only the left half is random. The right half mirrors it, which is what makes it look like a face.
    for (let x = 0; x < GRID_SIZE / 2; x++) {
      const roll = random();
      if (roll < 0.45) {
        continue;
      }
      context.fillStyle = roll < 0.85 ? `hsl(${hue} 55% 58%)` : `hsl(${(hue + 40) % 360} 65% 74%)`;
      context.fillRect(x, y, 1, 1);
      context.fillRect(GRID_SIZE - 1 - x, y, 1, 1);
    }
  }
}

// FNV-1a: turns a string into a number
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

// mulberry32: a tiny random number generator that gives the same sequence for the same seed
function createRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
