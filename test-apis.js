import "dotenv/config";

// Test all API integrations for the Trip Planner application

console.log("🔍 Trip Planner API Health Check\n");
console.log("=".repeat(50));

const results = {
    passed: [],
    failed: []
};

// Helper function to run tests
async function runTest(name, testFn) {
    process.stdout.write(`\n📋 Testing ${name}... `);
    try {
        const result = await testFn();
        if (result.success) {
            console.log("✅ PASSED");
            if (result.details) console.log(`   ${result.details}`);
            results.passed.push(name);
        } else {
            console.log("❌ FAILED");
            console.log(`   Error: ${result.error}`);
            results.failed.push({ name, error: result.error });
        }
    } catch (error) {
        console.log("❌ FAILED");
        console.log(`   Error: ${error.message}`);
        results.failed.push({ name, error: error.message });
    }
}

// 1. Test Environment Variables
await runTest("Environment Variables", async () => {
    const required = {
        "OPENAI_API_KEY (OpenRouter)": process.env.OPENAI_API_KEY,
        "PLACES_API_KEY (Geoapify)": process.env.PLACES_API_KEY,
        "MAPPLS_CLIENT_ID": process.env.MAPPLS_CLIENT_ID,
        "MAPPLS_CLIENT_SECRET": process.env.MAPPLS_CLIENT_SECRET,
        "GOOGLE_API_KEY": process.env.GOOGLE_API_KEY
    };

    const missing = Object.entries(required)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        return { success: false, error: `Missing: ${missing.join(", ")}` };
    }
    return { success: true, details: "All required API keys are configured" };
});

// 2. Test Geoapify Places API (Geocoding)
await runTest("Geoapify API (Geocoding)", async () => {
    const { getCoordinates } = await import("./services/places.service.js");
    const coords = await getCoordinates("Mumbai");

    if (!coords || !coords.lat || !coords.lon) {
        return { success: false, error: "Failed to geocode 'Mumbai'" };
    }
    return { success: true, details: `Mumbai: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` };
});

// 3. Test Geoapify Places API (Places Search)
await runTest("Geoapify API (Places Search)", async () => {
    const { getPlacesByLocation } = await import("./services/places.service.js");
    // Use coordinates for Goa
    const places = await getPlacesByLocation(15.4909, 73.8278);

    if (!places || places.length === 0) {
        return { success: false, error: "No places found near Goa" };
    }
    return { success: true, details: `Found ${places.length} places near Goa` };
});

// 4. Test Mappls API (OAuth Token)
await runTest("Mappls API (OAuth Token)", async () => {
    const { getAccessToken } = await import("./services/mappls.service.js");
    const token = await getAccessToken();

    if (!token) {
        return { success: false, error: "Failed to get Mappls access token" };
    }
    return { success: true, details: `Token received (length: ${token.length})` };
});

// 5. Test Mappls API (Distance/Route)
await runTest("Mappls API (Distance/Route)", async () => {
    const { getDistanceInfo } = await import("./services/mappls.service.js");
    const distance = await getDistanceInfo("Mumbai", "Pune");

    if (!distance || !distance.distanceKm) {
        return { success: false, error: "Failed to get distance between Mumbai and Pune" };
    }
    return { success: true, details: `Mumbai to Pune: ${distance.distanceText}, ${distance.durationText}` };
});

// 6. Test Overpass API (Dining)
await runTest("Overpass API (Dining)", async () => {
    const { getRestaurants } = await import("./services/dining.service.js");
    // Coordinates for Goa
    const restaurants = await getRestaurants(15.4909, 73.8278);

    if (!restaurants) {
        return { success: false, error: "Overpass API returned null" };
    }
    return { success: true, details: `Found ${restaurants.length} restaurants in Goa area` };
});

// 7. Test Overpass API (Hotels)
await runTest("Overpass API (Hotels)", async () => {
    const { getHotels } = await import("./services/hotel.service.js");
    // Coordinates for Goa
    const hotels = await getHotels(15.4909, 73.8278);

    if (!hotels) {
        return { success: false, error: "Overpass API returned null" };
    }
    return { success: true, details: `Found ${hotels.length} hotels in Goa area` };
});

// 8. Test Google Places API (Images)
await runTest("Google Places API (Images)", async () => {
    const { getPlaceImage } = await import("./services/image.service.js");
    const imageUrl = await getPlaceImage("Taj Mahal", "Agra");

    if (!imageUrl) {
        return { success: false, error: "No image URL returned for Taj Mahal" };
    }
    return { success: true, details: `Image URL received for Taj Mahal` };
});

// 9. Test OpenRouter LLM API
await runTest("OpenRouter LLM API", async () => {
    const { callLLM } = await import("./services/llm.service.js");
    const response = await callLLM("Say 'API working' in exactly 2 words.");

    if (!response) {
        return { success: false, error: "No response from LLM" };
    }
    // Check if it's the fallback response
    if (response.includes("automatically generated backup")) {
        return { success: false, error: "LLM using fallback (API key may be invalid)" };
    }
    return { success: true, details: `Response received (${response.length} chars)` };
});

// Print summary
console.log("\n" + "=".repeat(50));
console.log("\n📊 SUMMARY\n");
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);

if (results.failed.length > 0) {
    console.log("\n⚠️  Failed Tests:");
    results.failed.forEach(({ name, error }) => {
        console.log(`   • ${name}: ${error}`);
    });
}

console.log("\n" + "=".repeat(50));
process.exit(results.failed.length > 0 ? 1 : 0);
