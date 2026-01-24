import "dotenv/config";
import { getMapData } from "./services/mappls.service.js";

async function testMapData() {
    console.log("Testing getMapData for Mumbai -> Goa...");

    try {
        const result = await getMapData("Mumbai", "Goa");

        console.log("\n--- RESULT ---");
        console.log(JSON.stringify(result, null, 2));

        // Validation Checks
        console.log("\n--- VALIDATION ---");

        if (result.error) {
            console.error("❌ Error returned:", result.error);
            return;
        }

        // 1. Source Coordinates
        if (result.source && result.source.lat && result.source.lng) {
            console.log(`✅ Source Coords: [${result.source.lat}, ${result.source.lng}]`);
        } else {
            console.error("❌ Invalid Source Coords:", result.source);
        }

        // 2. Destination Coordinates
        if (result.destination && result.destination.lat && result.destination.lng) {
            console.log(`✅ Destination Coords: [${result.destination.lat}, ${result.destination.lng}]`);
        } else {
            console.error("❌ Invalid Destination Coords:", result.destination);
        }

        // 3. Route
        if (result.route && result.route.geometry) {
            console.log("✅ Route geometry present (length: " + result.route.geometry.length + ")");
        } else {
            console.error("❌ Missing route geometry");
        }

        // 4. Places
        if (result.places && Array.isArray(result.places) && result.places.length > 0) {
            const firstPlace = result.places[0];
            console.log(`✅ Found ${result.places.length} places.`);
            console.log(`   Sample Place: ${firstPlace.name} at [${firstPlace.lat}, ${firstPlace.lng}]`);
        } else {
            console.warn("⚠️ No places found (might be valid if API returns none, but check logic)");
        }

    } catch (error) {
        console.error("❌ Exception:", error);
    }
}

testMapData();
