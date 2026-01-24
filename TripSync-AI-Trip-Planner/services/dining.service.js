import axios from 'axios';

export const getRestaurants = async (lat, lon, radius = 1000) => {
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const query = `
    [out:json][timeout:5];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lon});
      way["amenity"="restaurant"](around:${radius},${lat},${lon});
    );
    out center 15;
  `;

    try {
        console.log("Fetching dining data...");
        const response = await axios.post(overpassUrl, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 8000 // Increased timeout to 8s
        });

        const restaurants = [];

        // Check for valid response structure
        if (!response.data || !response.data.elements) {
            console.log("No dining data received");
            return [];
        }

        for (const element of response.data.elements) {
            const tags = element.tags || {};
            const name = tags.name;
            const cuisine = tags.cuisine;
            const city = tags["addr:city"];
            const address = tags["addr:full"] || tags["addr:street"] ? `${tags["addr:number"] || ''} ${tags["addr:street"] || ''}`.trim() : "";

            if (name) {
                restaurants.push({
                    name: name,
                    cuisine: cuisine || "Various",
                    city: city || "",
                    address: address || "",
                    type: "restaurant",
                    lat: element.lat || element.center?.lat,
                    lon: element.lon || element.center?.lon
                });
            }
        }

        // Return top 10 unique restaurants
        return restaurants
            .filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i)
            .slice(0, 10);

    } catch (error) {
        console.error("Error fetching restaurants:", error.message);
        return [];
    }
};
