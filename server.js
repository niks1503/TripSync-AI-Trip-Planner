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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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
    const fs = await import("fs");
    const dbPath = path.join(__dirname, "data/processed/database.json");

    let allPlaces = [];
    if (fs.existsSync(dbPath)) {
      allPlaces = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } else {
      console.warn("⚠️ Database not found. Falling back to live API only.");
    }

    // --- STEP 2: CONTEXT GATHERING ---
    // Optimistic Local Lookup for Coordinates
    let coords = null;
    const localDest = allPlaces.find(p => p.place_name.toLowerCase() === destination.toLowerCase() || p.place_name.toLowerCase().includes(destination.toLowerCase()));

    if (localDest) {
      if (localDest.lat && localDest.lon) {
        console.log(`📍 Found ${destination} in local database. Using stored coordinates.`);
        coords = { lat: parseFloat(localDest.lat), lon: parseFloat(localDest.lon) };
      } else {
        console.log(`📍 Found ${destination} in local database (No Lat/Lon). Using mock coordinates to enable ML pipeline.`);
        coords = { lat: 18.0, lon: 73.0 }; // Default to general Maharashtra region approximately
      }
    } else {
      coords = await getCoordinates(destination);
    }

    // RAG & Distance
    const ragQuery = `Travel rules and safety for ${destination} in Maharashtra during this season.`;
    const ragPromise = queryRag(ragQuery);
    const distancePromise = getDistanceInfo(source, destination);

    const [ragResponse, distanceInfo] = await Promise.all([ragPromise, distancePromise]);

    // Handle structured RAG response
    const ragContext = ragResponse.answer || ""; // Extract string for LLM

    // --- STEP 3: FEATURE ENGINEERING & RANKING ---
    let rankedPlaces = [];

    if (coords && allPlaces.length > 0) {
      const { CacheService } = await import("./services/cache.service.js");
      const rankingKey = CacheService.generateRankingKey(destination, preferences);
      const cachedRankingIds = CacheService.getRanking(rankingKey);

      if (cachedRankingIds) {
        console.log(`CACHE HIT: Using cached ranking for ${rankingKey}`);
        rankedPlaces = cachedRankingIds
          .map(id => allPlaces.find(p => p.place_id == id))
          .filter(Boolean);
      } else {
        console.log(`CACHE MISS: Computing ranking for ${rankingKey}`);

        // --- ML RECOMENDATION ENGINE INTEGRATION ---
        const { getMLRecommendations } = await import("./services/recommendation.service.js");
        console.log("🤖 Asking ML Engine to rank places based on:", userPreferences);

        let mlResults = await getMLRecommendations(userPreferences, allPlaces);

        if (mlResults && mlResults.length > 0) {
          console.log(`✅ ML Engine returned ${mlResults.length} matches`);
          // Map ML results back to full place objects, preserving the ML score
          rankedPlaces = mlResults.map(mlItem => {
            const fullPlace = allPlaces.find(p => p.place_id == mlItem.place_id);
            if (fullPlace) {
              return { ...fullPlace, score: mlItem.ml_score, features: { ml_score: mlItem.ml_score } };
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
            let features = CacheService.getFeatureVector(p.place_id);
            if (!features) {
              features = buildFeatureVector(p, context);
              CacheService.setFeatureVector(p.place_id, features);
            }
            const score = (features.distance_score * 0.4) +
              (features.popularity_score * 0.3) +
              (features.budget_score * 0.2) +
              (features.time_feasibility_score * 0.1);
            return { ...p, score, features };
          });

          scoredPlaces.sort((a, b) => b.score - a.score);
          rankedPlaces = scoredPlaces.slice(0, 15);
        }

        CacheService.setRanking(rankingKey, rankedPlaces.map(p => p.place_id));
        CacheService.saveFeatures();
      }
    } else {
      console.log("Using live API fallback for places...");
      rankedPlaces = await getPlacesByName(destination);
    }

    // --- STEP 4: PROMPT CONSTRUCTION ---
    console.log("Building Intelligence-Aware Prompt...");

    // DEBUG: Check if rankedPlaces has attractions/dining
    if (rankedPlaces.length > 0) {
      const p1 = rankedPlaces[0];
      console.log(`DEBUG: Top Place: ${p1.place_name} (ID: ${p1.place_id})`);
      console.log(`DEBUG: Attractions Count: ${p1.attractions ? p1.attractions.length : 0}`);
      if (p1.attractions && p1.attractions.length > 0) {
        console.log(`DEBUG: Spot 1 Dining: ${JSON.stringify(p1.attractions[0].dining)}`);
      }
    }

    const prompt = buildPrompt(
      { destination, source, budget: totalBudget, budgetTier, people, days, transportMode, preferences: userPreferences },
      { places: rankedPlaces, ragContext, distanceInfo, dayPlan: rankedPlaces.mlItinerary }
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
    const { CacheService } = await import("./services/cache.service.js");
    const { explainRanking } = await import("./services/explainability/explainRank.js");
    const fs = await import("fs");
    const dbPath = path.join(__dirname, "data/processed/database.json");

    // 1. Load Data
    let allPlaces = [];
    let processingNotes = [];
    if (fs.existsSync(dbPath)) {
      allPlaces = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
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
      const rankingKey = CacheService.generateRankingKey(destination, preferences);
      const cachedRankingIds = CacheService.getRanking(rankingKey);

      if (cachedRankingIds) {
        processingNotes.push(`CACHE HIT: Using cached ranking for key '${rankingKey}'`);
        cacheHit = true;
        rankedPlaces = cachedRankingIds
          .map(id => allPlaces.find(p => p.place_id == id))
          .filter(Boolean)
          .map(p => {
            const cachedFeatures = CacheService.getFeatureVector(p.place_id);
            const logic = explainRanking(cachedFeatures);
            return {
              ...p,
              features: cachedFeatures || {},
              score: 'CACHED',
              reasoning: logic
            };
          });
      } else {
        processingNotes.push(`CACHE MISS: Computing ranking for key '${rankingKey}'`);

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
          let features = CacheService.getFeatureVector(p.place_id);
          if (!features) {
            features = buildFeatureVector(p, context);
            CacheService.setFeatureVector(p.place_id, features);
          }

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

        CacheService.setRanking(rankingKey, rankedPlaces.map(p => p.place_id));
        CacheService.saveFeatures();
      }
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