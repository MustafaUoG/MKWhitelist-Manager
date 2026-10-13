const { app, nativeImage, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Looks up Minecraft names and skins from Mojang. These are the only network requests the app makes.

const PROFILE_URL = 'https://sessionserver.mojang.com/session/minecraft/profile/';
const SKIN_HOST = 'textures.minecraft.net';
const REQUEST_TIMEOUT_MS = 8000;
// Mojang limits how often it can be asked, and names rarely change, so answers are reused for a day
const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;

const SKIN_WIDTH = 64;
const FACE_SIZE = 8;
// Where the face and the hat layer drawn over it sit inside a skin image
const FACE_ORIGIN = { x: 8, y: 8 };
const HAT_ORIGIN = { x: 40, y: 8 };
// On old-format skins, the whole area the hat layer lives in
const LEGACY_HAT_AREA = { x: 32, y: 0, width: 32, height: 16 };

class RateLimitError extends Error {}

// uuid -> { name, face, fetchedAt }. name is null when Mojang has no account with that UUID.
let cache = null;

function cacheFile() {
  return path.join(app.getPath('userData'), 'profiles-cache.json');
}

function loadCache() {
  if (cache === null) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    } catch {
      cache = {};
    }
  }
  return cache;
}

function saveCache() {
  fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
  fs.writeFileSync(cacheFile(), JSON.stringify(cache));
}

function isFresh(entry) {
  return Date.now() - entry.fetchedAt < CACHE_LIFETIME_MS;
}

// Real Minecraft accounts always have a version 4 UUID (the 4 at the start of the third group).
// Offline-mode and Bedrock players have other kinds, which Mojang knows nothing about, so there is no point asking.
function isMojangUuid(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function request(url) {
  return net.fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function fetchProfile(uuid) {
  const response = await request(PROFILE_URL + uuid.replaceAll('-', ''));

  if (response.status === 429) {
    throw new RateLimitError('Mojang is rate limiting lookups.');
  }
  // 204 means Mojang has no account with this UUID. That is remembered too, so it isn't asked again all day.
  if (response.status === 204 || response.status === 404) {
    return { name: null, face: null, fetchedAt: Date.now() };
  }
  if (!response.ok) {
    throw new Error(`Mojang answered with status ${response.status}.`);
  }

  const profile = await response.json();
  const entry = { name: String(profile.name), face: null, fetchedAt: Date.now() };

  const skinUrl = skinUrlOf(profile);
  if (skinUrl) {
    try {
      entry.face = await fetchFace(skinUrl);
    } catch {
      // The name is still worth showing. Marking the entry as already expired makes the next lookup try the skin again.
      entry.fetchedAt = 0;
    }
  }
  return entry;
}

// The skin link is inside a base64-encoded block of JSON in the profile. Returns null if the player has no custom skin.
function skinUrlOf(profile) {
  const textures = profile.properties?.find((property) => property.name === 'textures');
  if (!textures) {
    return null;
  }

  const decoded = JSON.parse(Buffer.from(textures.value, 'base64').toString('utf8'));
  const url = decoded.textures?.SKIN?.url;
  if (!url) {
    return null;
  }

  // Only ever download from Mojang's own texture server, and always over https (the link comes as http)
  const parsed = new URL(url);
  if (parsed.hostname !== SKIN_HOST) {
    return null;
  }
  parsed.protocol = 'https:';
  return parsed.toString();
}

async function fetchFace(skinUrl) {
  const response = await request(skinUrl);
  if (!response.ok) {
    throw new Error(`Skin download failed with status ${response.status}.`);
  }
  return cutOutFace(nativeImage.createFromBuffer(Buffer.from(await response.arrayBuffer())));
}

// Returns the player's face as 8x8 pixels (4 bytes each: red, green, blue, alpha) in base64,
// ready for the page to put on a canvas. Returns null if the image isn't a skin.
function cutOutFace(skin) {
  const { width, height } = skin.getSize();
  const isLegacy = height === 32;
  if (width !== SKIN_WIDTH || (height !== 64 && !isLegacy)) {
    return null;
  }

  // Electron gives each pixel as blue, green, red, alpha, with the colours already multiplied by the alpha
  const pixels = skin.toBitmap();
  const offsetOf = (x, y) => (y * width + x) * 4;
  const drawHat = !(isLegacy && isFullyOpaque(pixels, offsetOf, LEGACY_HAT_AREA));

  const face = Buffer.alloc(FACE_SIZE * FACE_SIZE * 4);
  for (let y = 0; y < FACE_SIZE; y++) {
    for (let x = 0; x < FACE_SIZE; x++) {
      const base = offsetOf(FACE_ORIGIN.x + x, FACE_ORIGIN.y + y);
      const hat = offsetOf(HAT_ORIGIN.x + x, HAT_ORIGIN.y + y);
      // How much of the face shows through the hat pixel on top of it
      const showThrough = drawHat ? 1 - pixels[hat + 3] / 255 : 1;
      const out = (y * FACE_SIZE + x) * 4;

      for (let channel = 0; channel < 3; channel++) {
        const hatColor = drawHat ? pixels[hat + channel] : 0;
        // 2 - channel turns blue-green-red into red-green-blue
        face[out + 2 - channel] = Math.round(hatColor + pixels[base + channel] * showThrough);
      }
      face[out + 3] = 255;
    }
  }
  return face.toString('base64');
}

// Old skins had no transparency, and many filled the unused hat area with a solid colour. Drawing that would
// cover the face, so (like the game does) a hat area with no see-through pixels at all is treated as empty.
function isFullyOpaque(pixels, offsetOf, area) {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      if (pixels[offsetOf(x, y) + 3] < 128) {
        return false;
      }
    }
  }
  return true;
}

function toProfiles(uuids, entryFor) {
  const profiles = {};
  for (const uuid of uuids) {
    const entry = entryFor(uuid);
    if (entry?.name) {
      profiles[uuid] = { name: entry.name, face: entry.face };
    }
  }
  return profiles;
}

// What is already known about these UUIDs, without going online. Old answers are included, since a
// possibly outdated name is better than none while lookup() checks for a newer one.
function cached(uuids) {
  const entries = loadCache();
  return toProfiles(uuids, (uuid) => entries[uuid]);
}

// Looks these UUIDs up with Mojang, all at once, skipping any with a fresh answer in the cache.
// Resolves to { profiles: { uuid: { name, face } }, rateLimited }. UUIDs that couldn't be found are left out.
async function lookup(uuids) {
  const entries = loadCache();
  let rateLimited = false;
  let cacheChanged = false;

  await Promise.all(uuids.filter(isMojangUuid).map(async (uuid) => {
    if (entries[uuid] && isFresh(entries[uuid])) {
      return;
    }
    try {
      entries[uuid] = await fetchProfile(uuid);
      cacheChanged = true;
    } catch (error) {
      // No internet, a timeout or a rate limit. Whatever is in the cache (if anything) keeps being used.
      rateLimited ||= error instanceof RateLimitError;
    }
  }));

  if (cacheChanged) {
    saveCache();
  }
  return { profiles: toProfiles(uuids, (uuid) => entries[uuid]), rateLimited };
}

module.exports = { cached, lookup };
