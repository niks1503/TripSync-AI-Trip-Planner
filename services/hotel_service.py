"""
Hotel Service - Fetches hotels/hostels using Overpass API
"""
import requests
import logging

logger = logging.getLogger(__name__)


def get_hotels(lat: float, lon: float, radius: int = 2000) -> list:
    """
    Fetch hotels/hostels near coordinates using Overpass API.
    
    Args:
        lat: Latitude
        lon: Longitude
        radius: Search radius in meters (default 2000)
    
    Returns:
        List of hotel dicts with name, type, contact info, lat, lon
    """
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:15];
    (
      node["tourism"~"hotel|hostel|guest_house|motel|apartment|resort"](around:{radius},{lat},{lon});
      way["tourism"~"hotel|hostel|guest_house|motel|apartment|resort"](around:{radius},{lat},{lon});
    );
    out center tags;
    """

    try:
        logger.info("Fetching hotel data...")
        response = requests.post(
            overpass_url,
            data={"data": query},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        hotels = []
        elements = data.get("elements", [])

        for element in elements:
            tags = element.get("tags", {})
            name = tags.get("name")

            if not name:
                continue

            hotel_type = tags.get("tourism", "hotel")
            city = tags.get("addr:city", "")
            state = tags.get("addr:state", "")
            pincode = tags.get("addr:postcode", "")
            phone = tags.get("contact:phone") or tags.get("phone", "")
            website = tags.get("contact:website") or tags.get("website", "")

            # Get coordinates (handle both node and way elements)
            elem_lat = element.get("lat") or (element.get("center", {}).get("lat"))
            elem_lon = element.get("lon") or (element.get("center", {}).get("lon"))

            hotels.append({
                "name": name,
                "type": hotel_type,
                "city": city,
                "state": state,
                "pincode": pincode,
                "phone": phone,
                "website": website,
                "lat": elem_lat,
                "lon": elem_lon
            })

        # Return top 10 unique hotels
        seen_names = set()
        unique_hotels = []
        for h in hotels:
            if h["name"] not in seen_names:
                seen_names.add(h["name"])
                unique_hotels.append(h)
                if len(unique_hotels) >= 10:
                    break

        return unique_hotels

    except requests.RequestException as e:
        logger.error(f"Error fetching hotels: {e}")
        return []
