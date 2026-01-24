import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Base Paths to be at root/storage
const STORAGE_DIR = path.join(__dirname, '../storage');
const FEATURE_CACHE_PATH = path.join(STORAGE_DIR, 'feature_cache.json');
const RANKING_CACHE_PATH = path.join(STORAGE_DIR, 'ranking_cache.json');

// Ensure storage exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Helper to Load/Save
function loadJSON(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error loading cache from ${filePath}:`, e);
        return {};
    }
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error saving cache to ${filePath}:`, e);
    }
}

// In-Memory Instances
let featureCache = loadJSON(FEATURE_CACHE_PATH);
let rankingCache = loadJSON(RANKING_CACHE_PATH);

export const CacheService = {
    // --- Features ---
    getFeatureVector: (placeId) => {
        return featureCache[placeId] || null;
    },

    setFeatureVector: (placeId, vector) => {
        featureCache[placeId] = vector;
    },

    saveFeatures: () => {
        saveJSON(FEATURE_CACHE_PATH, featureCache);
    },

    // --- Rankings ---
    getRanking: (key) => {
        const cached = rankingCache[key];
        // optional: check TTL here if we stored timestamp
        return cached || null;
    },

    setRanking: (key, rankedPlaceIds) => {
        rankingCache[key] = rankedPlaceIds;
        // Auto-save ranking immediately as it's modified less frequently in bulk
        saveJSON(RANKING_CACHE_PATH, rankingCache);
    },

    // --- Utilities ---
    generateRankingKey: (destination, preferences) => {
        // Create a stable key from inputs
        const dest = (destination || "").toLowerCase().trim();
        const prefs = Array.isArray(preferences)
            ? preferences.map(p => p.toLowerCase().trim()).sort().join('_')
            : "general";
        return `${dest}|${prefs}`;
    }
};
