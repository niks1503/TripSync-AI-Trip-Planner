
import "dotenv/config";
import { getMapData } from "./services/mappls.service.js";

async function test() {
    console.log("Testing getMapData for Mumbai -> Goa...");
    try {
        const data = await getMapData("Mumbai", "Goa");

        console.log("Source:", data.source);
        console.log("Destination:", data.destination);
        console.log("Route Geometry Type:", data.route ? "Found" : "Missing");
        console.log("Places Count:", data.places ? data.places.length : 0);

        if (data.places && data.places.length > 0) {
            console.log("First Place:", data.places[0]);
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
