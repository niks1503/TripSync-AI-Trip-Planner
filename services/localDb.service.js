import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = path.join(__dirname, "../data/processed/database.json");

function safeLower(s) {
  return (s || "").toString().trim().toLowerCase();
}

function getMaxNumericId(items, key) {
  let max = 0;
  for (const item of items || []) {
    const raw = item?.[key];
    const n = typeof raw === "number" ? raw : parseInt(raw, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function loadLocalDb(dbPath = DEFAULT_DB_PATH) {
  if (!fs.existsSync(dbPath)) return [];
  const raw = fs.readFileSync(dbPath, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocalDb(db, dbPath = DEFAULT_DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

export function findDestination(db, destinationName) {
  const d = safeLower(destinationName);
  if (!d) return null;

  // Prefer exact match; fallback to substring match.
  const exact = db.find(p => safeLower(p?.place_name) === d);
  if (exact) return exact;
  return db.find(p => safeLower(p?.place_name).includes(d));
}

export function upsertDestination(db, destination) {
  const nextDb = Array.isArray(db) ? db : [];
  const nameKey = safeLower(destination?.place_name);
  if (!nameKey) return { db: nextDb, destination: null, created: false, updated: false };

  const idx = nextDb.findIndex(p => safeLower(p?.place_name) === nameKey);
  if (idx >= 0) {
    const existing = nextDb[idx] || {};
    // Merge but keep existing nested arrays if present.
    const merged = {
      ...existing,
      ...destination,
      attractions: Array.isArray(destination?.attractions)
        ? destination.attractions
        : (existing.attractions || [])
    };
    nextDb[idx] = merged;
    return { db: nextDb, destination: merged, created: false, updated: true };
  }

  // Assign new place_id if missing.
  const maxPlaceId = getMaxNumericId(nextDb, "place_id");
  const toInsert = {
    place_id: destination?.place_id ?? String(maxPlaceId + 1),
    state: destination?.state ?? "Unknown",
    description: destination?.description ?? "",
    attractions: Array.isArray(destination?.attractions) ? destination.attractions : [],
    ...destination
  };
  nextDb.push(toInsert);
  return { db: nextDb, destination: toInsert, created: true, updated: false };
}

export function buildDestinationFromApi({ destinationName, coords, places = [] }, existingDb = []) {
  const maxPlaceId = getMaxNumericId(existingDb, "place_id");
  const maxSpotId = (() => {
    let max = 0;
    for (const dest of existingDb) {
      const attractions = dest?.attractions || [];
      const m = getMaxNumericId(attractions, "spot_id");
      if (m > max) max = m;
    }
    return max;
  })();

  const placeId = String(maxPlaceId + 1);

  const attractions = (places || [])
    .filter(p => p && (p.name || p.place_name))
    .slice(0, 20)
    .map((p, i) => {
      const spotId = String(maxSpotId + 1 + i);
      const spotName = p.name || p.place_name;
      return {
        spot_id: spotId,
        place_id: placeId,
        spot_name: spotName,
        description: p.address || p.category || p.type || "Attraction",
        lat: p.lat ?? null,
        lon: p.lon ?? null,
        dining: [],
        accommodation: []
      };
    });

  return {
    place_id: placeId,
    place_name: destinationName,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    state: "Unknown",
    description: "Auto-added from live APIs",
    attractions
  };
}

