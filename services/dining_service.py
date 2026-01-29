"""
Dining Service - Fetches restaurants using Overpass API
"""
import requests
import logging

logger = logging.getLogger(__name__)


def get_restaurants(lat: float, lon: float, radius: int = 1000) -> list:
    """
    Fetch restaurants near coordinates using Overpass API.
    
    Args:
        lat: Latitude
        lon: Longitude
        radius: Search radius in meters (default 1000)
    
    Returns:
        List of restaurant dicts with name, cuisine, address, lat, lon
    """
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:5];
    (
      node["amenity"="restaurant"](around:{radius},{lat},{lon});
      way["amenity"="restaurant"](around:{radius},{lat},{lon});
    );
    out center 15;
    """

    try:
        logger.info("Fetching dining data...")
        response = requests.post(
            overpass_url,
            data={"data": query},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=8
        )
        response.raise_for_status()
        data = response.json()

        restaurants = []
        elements = data.get("elements", [])

        for element in elements:
            tags = element.get("tags", {})
            name = tags.get("name")

            if not name:
                continue

            cuisine = tags.get("cuisine", "Various")
            city = tags.get("addr:city", "")
            
            # Build address
            addr_number = tags.get("addr:number", "")
            addr_street = tags.get("addr:street", "")
            address = f"{addr_number} {addr_street}".strip() if addr_street else ""

            # Get coordinates (handle both node and way elements)
            elem_lat = element.get("lat") or (element.get("center", {}).get("lat"))
            elem_lon = element.get("lon") or (element.get("center", {}).get("lon"))

            restaurants.append({
                "name": name,
                "cuisine": cuisine,
                "city": city,
                "address": address,
                "type": "restaurant",
                "lat": elem_lat,
                "lon": elem_lon
            })

        # Return top 10 unique restaurants
        seen_names = set()
        unique_restaurants = []
        for r in restaurants:
            if r["name"] not in seen_names:
                seen_names.add(r["name"])
                unique_restaurants.append(r)
                if len(unique_restaurants) >= 10:
                    break

        return unique_restaurants

    except requests.RequestException as e:
        logger.error(f"Error fetching restaurants: {e}")
        return []
