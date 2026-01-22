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

  // Calculate Budget Tier based on Total Budget
  const totalBudget = parseInt(budget);
  let budgetTier = "Medium"; // Default

  if (totalBudget < 20000) {
    budgetTier = "Low";
  } else if (totalBudget >= 20000 && totalBudget <= 30000) {
    budgetTier = "Medium";
  } else if (totalBudget > 30000) {
    budgetTier = "High";
  }

  // Map transport mode
  const transportModes = {
    any: "Best available option (flight/train/bus)",
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

  // Stream function (simulating typing effect, but faster)
  const stream = async (text) => {
    // Send larger chunks for better performance
    const chunkSize = 5;
    for (let i = 0; i < text.length; i += chunkSize) {
      await new Promise(resolve => {
        res.write(text.slice(i, i + chunkSize));
        setTimeout(resolve, 5); // Faster typing speed
      });
    }
  };

  try {
    // 1. Get Context (Real places, Dining, Hotels, Distance)
    console.log(`Fetching context for ${destination}...`);

    // Fetch coordinates first for specific searches
    const coords = await getCoordinates(destination);

    let placesPromise = getPlacesByName(destination);
    let diningPromise = Promise.resolve([]);
    let hotelsPromise = Promise.resolve([]);
    let distancePromise = getDistanceInfo(source, destination);

    if (coords) {
      // If we have coords, we can fetch dining and hotels nearby
      diningPromise = getRestaurants(coords.lat, coords.lon);
      hotelsPromise = getHotels(coords.lat, coords.lon);
    }

    const [places, dining, hotels, distanceInfo] = await Promise.all([placesPromise, diningPromise, hotelsPromise, distancePromise]);

    // 2. Build Prompt
    console.log("Building prompt...");
    const prompt = buildPrompt({ destination, source, budget: totalBudget, budgetTier, people, days, transportMode, preferences: userPreferences }, { places, dining, hotels, distanceInfo });

    // 3. Call LLM
    console.log("Calling LLM...");
    const itinerary = await callLLM(prompt);

    // 4. Stream response
    await stream(itinerary);
    res.end();
  } catch (error) {
    console.error("Error in plan-trip:", error);
    // If headers aren't sent yet
    if (!res.headersSent) {
      res.status(500).json({ message: "Error generating itinerary" });
    } else {
      res.write("\n\nError: Failed to complete itinerary generation.");
      res.end();
    }
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

    // Also send the access token for frontend map initialization
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

    // Convert Google photo URLs to our proxy URLs
    const proxiedImageMap = {};
    for (const [name, url] of Object.entries(imageMap)) {
      if (url && url.includes('maps.googleapis.com')) {
        // Extract photo_reference from URL and create proxy URL
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

    // Fetch the image from Google
    const response = await fetch(photoUrl);

    if (!response.ok) {
      return res.status(response.status).send("Failed to fetch photo");
    }

    // Set content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Pipe the image data to the response
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