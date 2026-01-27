import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { callLLM } from "./services/llm.service.js";
import { buildPrompt } from "./services/prompt.builder.js";
import { getPlacesByName, getCoordinates } from "./services/places.service.js";
import { getRestaurants } from "./services/dining.service.js";
import { getHotels } from "./services/hotel.service.js";
import { getMapData, getAccessToken, getDistanceInfo } from "./services/mappls.service.js";
import { getPlaceImages } from "./services/image.service.js";
import {
  loadLocalDb,
  saveLocalDb,
  findDestination,
  upsertDestination,
  buildDestinationFromApi
} from "./services/localDb.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;


app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ STARTUP VALIDATION
console.log("\n🔍 Validating Configuration...");
const requiredEnvVars = ["GEOAPIFY_API_KEY", "GROQ_API_KEY"];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.warn("⚠️  Missing Environment Variables:", missingVars.join(", "));
  console.warn("   Please add to .env file and restart server.");
} else {
  console.log("✅ All required API keys configured");
}

console.log(`✅ Server configured on PORT ${PORT}\n`);

// ✅ Helper Function: Load Places from Database
async function loadPlacesData() {
  const fs = await import("fs");
  const dbPath = path.join(__dirname, "data/processed/database.json");
  
  let allPlaces = [];
  if (fs.existsSync(dbPath)) {
    allPlaces = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }
  return allPlaces;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/agent", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "agent.html"));
});

// Stream itinerary generation
app.post("/api/plan-trip", async (req, res) => {
  const { destination, budget, people, days, source, transport, preferences } = req.body;

  if (!destination || !budget || !people || !days || !source) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // --- STRICT VALIDATION GATE ---
  const { validateTrip } = await import("./services/validation/tripValidator.js");
  const validation = validateTrip({ budget, people, days });

  if (!validation.isValid) {
    console.warn("❌ Request Rejected by Validation Gate:", validation.errors);
    return res.status(400).json({
      error: "Trip Validation Failed",
      details: validation.errors,
      suggestions: validation.suggestions
    });
  }

  console.log("✅ Validation Passed. Proceeding to pipeline...");

  // Calculate Budget Tier
  const totalBudget = parseInt(budget);
  let budgetTier = "Medium";
  if (totalBudget < 20000) budgetTier = "Low";
  else if (totalBudget > 30000) budgetTier = "High";

  // Map transport mode
  const transportModes = {
    any: "Best available option",
    flight: "Flight",
    train: "Train",
    bus: "Bus",
    car: "Car / Self-Drive",
    bike: "Bike / Motorcycle"
  };
  const transportMode = transportModes[transport] || transportModes.any;

  // Format preferences
  const userPreferences = preferences && preferences.length > 0
    ? preferences.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
    : "General sightseeing";

  // Set headers for streaming
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const stream = async (text) => {
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      await new Promise(resolve => {
        res.write(text.slice(i, i + chunkSize));
        setTimeout(resolve, 5);
      });
    }
  };

  try {
    // SEE: /docs/system_flow.md for the complete Request Lifecycle (Step 1-6)
    console.log(`🚀 Plan-Trip Request: ${destination} (${days} days)`);

    // --- STEP 1: LOAD INTELLIGENCE ---
    const { buildFeatureVector } = await import("./services/featureEngineering/featureBuilder.js");
    const { queryRag } = await import("./services/rag/queryRag.js");

    let allPlaces = [];
    try {
      allPlaces = loadLocalDb(path.join(__dirname, "data/processed/database.json"));
      if (!allPlaces.length) console.warn("⚠️ Local database empty/not found. Will use live APIs and hydrate DB.");
    } catch (e) {
      console.warn("⚠️ Failed to load local database. Falling back to live APIs only.", e?.message || e);
      allPlaces = [];
    }

    // --- STEP 2: CONTEXT GATHERING ---
    // Optimistic Local Lookup for Coordinates
    let coords = null;
    let localDest = findDestination(allPlaces, destination);

    if (localDest) {
      if (localDest.lat && localDest.lon) {
        console.log(`📍 Found ${destination} in local database. Using stored coordinates.`);
        coords = { lat: parseFloat(localDest.lat), lon: parseFloat(localDest.lon) };
      } else {
        // Try to hydrate coordinates from API once, then persist.
        console.log(`📍 Found ${destination} in local database (No Lat/Lon). Fetching coords from API...`);
        const apiCoords = await getCoordinates(destination);
        if (apiCoords) {
          coords = { lat: parseFloat(apiCoords.lat), lon: parseFloat(apiCoords.lon) };
          const updated = { ...localDest, lat: coords.lat, lon: coords.lon };
          const up = upsertDestination(allPlaces, updated);
          allPlaces = up.db;
          localDest = up.destination || localDest;
          try { saveLocalDb(allPlaces, path.join(__dirname, "data/processed/database.json")); } catch { }
        } else {
          console.log(`📍 Coords API failed. Using mock coordinates to keep pipeline running.`);
          coords = { lat: 18.0, lon: 73.0 }; // Default to general Maharashtra region approximately
        }
      }
    } else {
      coords = await getCoordinates(destination);
      // If destination isn't in DB, fetch places and persist a minimal destination record.
      if (coords) {
        console.log(`🆕 ${destination} not in local DB. Fetching missing data from APIs and saving locally...`);
        const apiPlaces = await getPlacesByName(destination);
        const newDest = buildDestinationFromApi({ destinationName: destination, coords, places: apiPlaces }, allPlaces);
        const up = upsertDestination(allPlaces, newDest);
        allPlaces = up.db;
        localDest = up.destination;
        try {
          saveLocalDb(allPlaces, path.join(__dirname, "data/processed/database.json"));
          console.log(`💾 Saved '${destination}' into local database (${up.created ? "created" : "updated"}).`);
        } catch (e) {
          console.warn("⚠️ Failed saving hydrated destination to local DB:", e?.message || e);
        }
      }
    }

    // RAG & Distance
    const ragQuery = `Travel rules and safety for ${destination} during this season.`;
    const ragPromise = queryRag(ragQuery);
    const distancePromise = getDistanceInfo(source, destination);

    const [ragResponse, distanceInfo] = await Promise.all([ragPromise, distancePromise]);

    // Handle structured RAG response
    const ragContext = ragResponse.answer || ""; // Extract string for LLM

    // --- STEP 3: FEATURE ENGINEERING & RANKING ---
    let rankedPlaces = [];

    if (localDest && coords && allPlaces.length > 0) {
      // Direct computation without caching
      console.log(`Computing ranking for ${destination}`);

      // --- ML RECOMENDATION ENGINE INTEGRATION ---
      const { getMLRecommendations } = await import("./services/recommendation.service.js");
      console.log("🤖 Asking ML Engine to rank attractions in", destination, "based on:", userPreferences);

      // Pass destination to ML engine
      let mlResults = await getMLRecommendations(userPreferences, allPlaces, destination);

      if (mlResults && mlResults.length > 0) {
        console.log(`✅ ML Engine returned ${mlResults.length} matches`);

        // The ML engine now returns "Attractions" (spots), not "Destinations".
        // We need to find these spots within the localDest object (or allPlaces if we search)
        // Since we filtered by destination in ML, we should look in localDest.attractions if available.

        const sourceAttractions = localDest ? localDest.attractions : [];

        rankedPlaces = mlResults.map(mlItem => {
          // Find the full attraction object
          // mlItem has 'spot_name' or 'place_name' depending on data
          const nameToFind = mlItem.spot_name || mlItem.place_name;
          const fullPlace = sourceAttractions.find(p => p.spot_name === nameToFind);

          if (fullPlace) {
            return {
              ...fullPlace,
              // Ensure name is consistent for frontend
              place_name: fullPlace.spot_name,
              score: mlItem.ml_score,
              features: {
                ml_score: mlItem.ml_score,
                popularity_score: mlItem.scores ? mlItem.scores.preference : 0,
                distance_score: mlItem.scores ? mlItem.scores.distance : 0,
                time_feasibility_score: mlItem.scores ? mlItem.scores.feasibility : 0,
                budget_score: 0.5 // Default/Neutral
              }
            };
          }
          return null;
        }).filter(Boolean);
      } else {
        console.warn("⚠️ ML Engine returned no results. Falling back to Heuristic Scoring.");
        const context = {
          userLat: coords.lat,
          userLon: coords.lon,
          budget_level: budgetTier === 'High' ? 3 : (budgetTier === 'Low' ? 1 : 2),
          available_time_hours: 4
        };

        const scoredPlaces = allPlaces.map(p => {
          // Always calculate fresh features
          const features = buildFeatureVector(p, context);

          const score = (features.distance_score * 0.4) +
            (features.popularity_score * 0.3) +
            (features.budget_score * 0.2) +
            (features.time_feasibility_score * 0.1);
          return { ...p, score, features };
        });

        scoredPlaces.sort((a, b) => b.score - a.score);
        rankedPlaces = scoredPlaces.slice(0, 15);
      }
    } else {
      console.log("Using live API fallback for places...");
      rankedPlaces = await getPlacesByName(destination);
      console.log(`Live API returned ${rankedPlaces.length} places.`);
      if (rankedPlaces.length === 0) console.warn("WARNING: Live API returned 0 places!");
    }

    // --- STEP 3.5: FETCH AMENITIES (Hotels & Dining) ---
    console.log("Fetching Hotels & Dining options...");
    const [restaurants, hotels] = await Promise.all([
      getRestaurants(coords.lat, coords.lon),
      getHotels(coords.lat, coords.lon)
    ]);
    console.log(`Found ${restaurants?.length || 0} restaurants and ${hotels?.length || 0} hotels.`);

    // --- STEP 3.1: FLATTEN DESTINATION IF NEEDED ---
    // If we have a matching destination object, UNPACK its attractions so the LLM gets granular spots.
    // This fixes the "Itinerary Repetition" issue where the LLM only sees "1. Jaipur" and repeats it.
    if (rankedPlaces.length > 0) {
      const topMatch = rankedPlaces[0];
      const matchName = topMatch.place_name || topMatch.name || "";

      // If the top ranked item IS the destination (approx match) AND has nested attractions
      if (matchName.toLowerCase().includes(destination.toLowerCase()) && topMatch.attractions && topMatch.attractions.length > 0) {
        console.log(`📦 Unpacking ${topMatch.attractions.length} attractions from '${matchName}' for granular itinerary planning...`);

        // Replace the "City Object" with its "Attraction Objects"
        rankedPlaces = topMatch.attractions.map(attr => ({
          ...attr,
          name: attr.spot_name, // Normalize name
          score: topMatch.score || 0.8, // Inherit score 
          // Ensure dining/stay are preserved
          dining: attr.dining,
          accommodation: attr.accommodation
        }));
      }
    }

    // --- STEP 4: PROMPT CONSTRUCTION ---
    console.log("Building Intelligence-Aware Prompt...");

    // DEBUG: Check if rankedPlaces has attractions/dining
    if (rankedPlaces.length > 0) {
      const p1 = rankedPlaces[0];
      console.log(`DEBUG: Top Place: ${p1.place_name || p1.name} (keys: ${Object.keys(p1).join(',')})`);
      // console.log(`DEBUG: Dataset structure check - has attractions? ${!!p1.attractions}`);
    } else {
      console.log("DEBUG: rankedPlaces is empty!");
    }

    const prompt = buildPrompt(
      { destination, source, budget: totalBudget, budgetTier, people, days, transportMode, preferences: userPreferences },
      {
        places: rankedPlaces,
        ragContext,
        distanceInfo,
        dayPlan: rankedPlaces.mlItinerary,
        restaurants: restaurants || [],
        hotels: hotels || []
      }
    );

    // DEBUG: Print a snippet of the generated prompt
    console.log("DEBUG: Generated Prompt Snippet:\n", prompt.slice(prompt.indexOf("TOP RANKED"), prompt.indexOf("TOP RANKED") + 500));

    // --- STEP 5: LLM (Narrative Generation Only) ---
    console.log("Calling LLM for Narrative Generation...");
    const itinerary = await callLLM(prompt);

    await stream(itinerary);
    res.end();

  } catch (error) {
    console.error("Error in plan-trip:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating itinerary" });
    } else {
      res.write("\n\nError: Failed to complete itinerary generation.");
      res.end();
    }
  }
});

// Debug Endpoint: Trace Decision Logic
app.post("/api/debug/decision-trace", async (req, res) => {
  const { destination, source, budget, people, days, preferences } = req.body;

  if (!destination || !source) {
    return res.status(400).json({ message: "Destination and Source are required" });
  }

  try {
    // Import Services
    const { buildFeatureVector } = await import("./services/featureEngineering/featureBuilder.js");
    const { queryRag } = await import("./services/rag/queryRag.js");
    // Removed CacheService import
    const { explainRanking } = await import("./services/explainability/explainRank.js");

    // 1. Load Data
    let allPlaces = await loadPlacesData();
    let processingNotes = [];
    if (allPlaces.length > 0) {
      processingNotes.push(`Loaded ${allPlaces.length} places from database.`);
    } else {
      processingNotes.push("Database not found. Using empty list.");
    }

    // 2. Context Gathering
    const coordsPromise = getCoordinates(destination);
    const ragQuery = `Travel rules and safety for ${destination} in Maharashtra.`;
    const ragPromise = queryRag(ragQuery);
    const distancePromise = getDistanceInfo(source, destination);

    const [coords, ragResponse, distanceInfo] = await Promise.all([coordsPromise, ragPromise, distancePromise]);

    // 3. Feature Engineering & Ranking
    let rankedPlaces = [];
    let featureVectors = [];
    let cacheHit = false;

    if (coords && allPlaces.length > 0) {
      // Always compute fresh
      processingNotes.push(`Computing ranking for ${destination}`);

      const totalBudget = parseInt(budget) || 20000;
      let budgetLevel = 2;
      if (totalBudget < 20000) budgetLevel = 1;
      else if (totalBudget > 30000) budgetLevel = 3;

      const context = {
        userLat: coords.lat,
        userLon: coords.lon,
        budget_level: budgetLevel,
        available_time_hours: 4
      };

      const scoredPlaces = allPlaces.map(p => {
        // Always compute fresh features
        const features = buildFeatureVector(p, context);

        const score = (features.distance_score * 0.4) +
          (features.popularity_score * 0.3) +
          (features.budget_score * 0.2) +
          (features.time_feasibility_score * 0.1);

        const logic = explainRanking(features);
        featureVectors.push({ place_id: p.place_id, name: p.place_name, ...features });

        return { ...p, score, features, reasoning: logic };
      });

      scoredPlaces.sort((a, b) => b.score - a.score);
      rankedPlaces = scoredPlaces.slice(0, 20);
    }

    res.json({
      meta: {
        request: { destination, source, budget, days, preferences },
        processing_notes: processingNotes
      },
      context: {
        coordinates: coords,
        distance_info: distanceInfo,
        rag_knowledge_used: ragResponse // Full structured object
      },
      decisions: {
        ranking_strategy: "Weighted Sum: Distance(0.4) + Popularity(0.3) + Budget(0.2) + Time(0.1)",
        top_ranked_places: rankedPlaces.map(p => ({
          id: p.place_id,
          name: p.place_name,
          score: p.score,
          reasoning: p.reasoning, // Structured explanation
          category: p.category,
          features: p.features
        }))
      },
      data_dump: {
        normalized_sample: allPlaces.slice(0, 3)
      }
    });

  } catch (error) {
    console.error("Debug Endpoint Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get map data (route + places) for display
app.post("/api/map-data", async (req, res) => {
  const { source, destination } = req.body;

  if (!source || !destination) {
    return res.status(400).json({ message: "Source and destination are required" });
  }

  try {
    const mapData = await getMapData(source, destination);
    const accessToken = await getAccessToken();

    res.json({
      ...mapData,
      accessToken: accessToken
    });
  } catch (error) {
    console.error("Error getting map data:", error);
    res.status(500).json({ message: "Error fetching map data" });
  }
});

// Get images for places
app.post("/api/place-images", async (req, res) => {
  const { places, destination } = req.body;

  if (!places || !Array.isArray(places) || places.length === 0) {
    return res.status(400).json({ message: "Places array is required" });
  }

  try {
    console.log(`Fetching images for ${places.length} places in ${destination}...`);
    const imageMap = await getPlaceImages(places, destination);

    const proxiedImageMap = {};
    for (const [name, url] of Object.entries(imageMap)) {
      if (url && url.includes('maps.googleapis.com')) {
        const photoRefMatch = url.match(/photo_reference=([^&]+)/);
        if (photoRefMatch) {
          proxiedImageMap[name] = `/api/place-photo?ref=${encodeURIComponent(photoRefMatch[1])}`;
        } else {
          proxiedImageMap[name] = null;
        }
      } else {
        proxiedImageMap[name] = url;
      }
    }

    res.json({ images: proxiedImageMap });
  } catch (error) {
    console.error("Error fetching place images:", error);
    res.status(500).json({ message: "Error fetching images" });
  }
});

// Proxy endpoint for Google Place photos (to avoid CORS issues)
app.get("/api/place-photo", async (req, res) => {
  const { ref } = req.query;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

  if (!ref || !GOOGLE_API_KEY) {
    return res.status(400).send("Missing photo reference or API key");
  }

  try {
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(photoUrl);

    if (!response.ok) {
      return res.status(response.status).send("Failed to fetch photo");
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error proxying place photo:", error);
    res.status(500).send("Error fetching photo");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});