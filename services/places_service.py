import os
import requests
import math
import logging
from services.mappls_service import geocode, search_places

logger = logging.getLogger(__name__)

def get_places_by_location(lat, lon, radius=5000, category="tourism"):
    try:
        api_key = os.getenv("GEOAPIFY_API_KEY") or os.getenv("PLACES_API_KEY")
        if not api_key:
            return []

        # Bounding box calculation
        lat_offset = radius / 111000.0
        lon_offset = (radius / 111000.0) / math.cos(lat * math.pi / 180.0)

        min_lat = lat - lat_offset
        max_lat = lat + lat_offset
        min_lon = lon - lon_offset
        max_lon = lon + lon_offset

        url = "https://api.geoapify.com/v2/places"
        params = {
            "categories": category,
            "filter": f"rect:{min_lon},{min_lat},{max_lon},{max_lat}",
            "limit": 20,
            "apiKey": api_key
        }

        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            # Filter out places without names
            results = []
            for p in data.get("features", []):
                name = p["properties"].get("name")
                # Skip if no name or name is empty
                if not name or not name.strip():
                    continue
                results.append({
                    "name": name,
                    "address": p["properties"].get("address_line2"),
                    "category": p["properties"].get("category"),
                    "type": p["properties"].get("place_type"),
                    "lat": p["properties"].get("lat"),
                    "lon": p["properties"].get("lon"),
                    "website": p["properties"].get("website"),
                    "phone": p["properties"].get("phone")
                })
            return results
        return []
    except Exception as e:
        logger.error(f"Error fetching places: {e}")
        return []

def get_coordinates(destination):
    res = geocode(destination)
    if res:
        return {"lat": res["lat"], "lon": res["lng"]}
    return None

def get_places_by_name(destination):
    try:
        coords = get_coordinates(destination)
        if not coords:
            return []

        lat, lon = coords["lat"], coords["lon"]

        # 1. Try Geoapify
        places = get_places_by_location(lat, lon)
        if places:
            return places

        # 2. Fallback to Mappls Search Logic (ported)
        logger.info(f"Places: Geoapify returned 0 results for {destination}. Trying fallback...")
        mappls_places = search_places(lat, lon) # already implemented in mappls_service
        
        if mappls_places:
             return [
                {
                    "name": p["name"],
                    "address": p["address"],
                    "category": p.get("type", "tourist_attraction"),
                    "lat": p["lat"],
                    "lon": p["lng"],
                    "type": "tourism"
                }
                for p in mappls_places
            ]
            
        return []

    except Exception as e:
        logger.error(f"Error fetching places by name: {e}")
        return []

# Alias for compatibility
get_places_for_destination = get_places_by_name
