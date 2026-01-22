import axios from 'axios';

export const getHotels = async (lat, lon, radius = 2000) => {
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const query = `
    [out:json][timeout:15];
    (
      node["tourism"~"hotel|hostel|guest_house|motel|apartment|resort"](around:${radius},${lat},${lon});
      way["tourism"~"hotel|hostel|guest_house|motel|apartment|resort"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

    try {
        console.log("Fetching hotel data...");
        const response = await axios.post(overpassUrl, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000 // Client side timeout 15s to match API query timeout
        });

        const data = response.data;
        const hotels = [];

        for (const element of data.elements || []) {
            const tags = element.tags || {};
            const name = tags.name;
            const type = tags.tourism;

            const city = tags["addr:city"];
            const state = tags["addr:state"];
            const pincode = tags["addr:postcode"];
            const phone = tags["contact:phone"] || tags["phone"];
            const website = tags["contact:website"] || tags["website"];

            if (name) {
                hotels.push({
                    name: name,
                    type: type || "hotel",
                    city: city || "",
                    state: state || "",
                    pincode: pincode || "",
                    phone: phone || "",
                    website: website || "",
                    lat: element.lat || element.center?.lat,
                    lon: element.lon || element.center?.lon
                });
            }
        }

        // Return top 10 unique hotels
        return hotels
            .filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i)
            .slice(0, 10);

    } catch (error) {
        console.error("Error fetching hotels:", error.message);
        return [];
    }
};
