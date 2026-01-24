import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

// Helper to read CSV (handling comma separation in txt files)
const readCSV = (fileName) => {
    const filePath = path.join(RAW_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${fileName}`);
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].trim().split(',');

    return lines.slice(1).map(line => {
        // Handle commas inside quotes if any, simplistic split for now as data seems simple
        const values = line.trim().split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : null;
        });
        return row;
    });
};

const ingest = () => {
    console.log("Starting data ingestion...");

    // 1. Load Raw Data
    const places = readCSV('places.txt');
    const spots = readCSV('spots.txt');
    const food = readCSV('food_options.txt');
    const stay = readCSV('stay_options.txt');
    const travel = readCSV('travel_options.txt');

    console.log(`Loaded: ${places.length} places, ${spots.length} spots, ${food.length} food options, ${stay.length} stays, ${travel.length} travel routes.`);

    // 2. Build Relational Map
    // Map Places by ID
    const placesMap = {};
    places.forEach(p => {
        placesMap[p.place_id] = {
            ...p,
            attractions: [],
            travel_options: [] // Travel is linked to Place
        };
    });

    // Map Spots by ID and attach to Places
    const spotsMap = {};
    spots.forEach(s => {
        spotsMap[s.spot_id] = {
            ...s,
            dining: [],
            accommodation: []
        };

        if (placesMap[s.place_id]) {
            placesMap[s.place_id].attractions.push(spotsMap[s.spot_id]);
        }
    });

    // Attach Food to Spots
    food.forEach(f => {
        // In schema: food.spot_id -> spots.spot_id
        if (spotsMap[f.spot_id]) {
            spotsMap[f.spot_id].dining.push(f);
        } else {
            // Fallback: Check if it links directly to place (unlikely based on schema analysis but robust)
            // console.warn(`Orphaned food option: ${f.food_place_name} (spot_id: ${f.spot_id})`);
        }
    });

    // Attach Stay to Spots
    stay.forEach(s => {
        // In schema: stay.spot_id -> spots.spot_id
        if (spotsMap[s.spot_id]) {
            spotsMap[s.spot_id].accommodation.push(s);
        }
    });

    // Attach Travel to Places
    travel.forEach(t => {
        if (placesMap[t.place_id]) {
            placesMap[t.place_id].travel_options.push(t);
        }
    });

    // 3. Convert Map to Array
    const database = Object.values(placesMap);

    // 4. Save to Processed
    if (!fs.existsSync(PROCESSED_DIR)) {
        fs.mkdirSync(PROCESSED_DIR, { recursive: true });
    }

    const outputPath = path.join(PROCESSED_DIR, 'database.json');
    fs.writeFileSync(outputPath, JSON.stringify(database, null, 2));

    console.log(`Ingestion complete! Database saved to ${outputPath}`);
    console.log(`Total Destinations Processed: ${database.length}`);
};

ingest();
