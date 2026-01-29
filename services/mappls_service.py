import os
import time
import requests
import logging

logger = logging.getLogger(__name__)

# Token cache
_cached_token = None
_token_expiry = 0

def get_access_token():
    global _cached_token, _token_expiry
    
    if _cached_token and _token_expiry and time.time() < _token_expiry:
        return _cached_token

    try:
        url = "https://outpost.mappls.com/api/security/oauth/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": os.getenv("MAPPLS_CLIENT_ID"),
            "client_secret": os.getenv("MAPPLS_CLIENT_SECRET")
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        
        response = requests.post(url, data=data, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        _cached_token = token_data.get("access_token")
        # Cache for 23 hours
        _token_expiry = time.time() + (23 * 60 * 60)
        
        logger.info("Mappls token generated successfully")
        return _cached_token
        
    except Exception as e:
        logger.error(f"Error getting Mappls access token: {e}")
        return None

def geocode(location):
    try:
        geoapify_key = os.getenv("GEOAPIFY_API_KEY") or os.getenv("PLACES_API_KEY")
        
        if not geoapify_key:
            logger.error("❌ GEOAPIFY_API_KEY not configured")
            return None

        # Try Geoapify
        url = "https://api.geoapify.com/v1/geocode/search"
        params = {"text": location, "apiKey": geoapify_key, "limit": 1}
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("features"):
                feat = data["features"][0]
                return {
                    "lat": feat["properties"]["lat"],
                    "lng": feat["properties"]["lon"],
                    "name": feat["properties"]["formatted"] or location
                }

        logger.warning(f"Geoapify failed for {location}, trying Nominatim...")
        
        # Fallback Nominatim
        nom_url = "https://nominatim.openstreetmap.org/search"
        nom_params = {
            "q": location, 
            "format": "json", 
            "limit": 1
        }
        nom_headers = {"User-Agent": "TripPlannerApp/1.0"}
        
        nom_res = requests.get(nom_url, params=nom_params, headers=nom_headers)
        if nom_res.status_code == 200:
            data = nom_res.json()
            if data:
                feat = data[0]
                return {
                    "lat": float(feat["lat"]),
                    "lng": float(feat["lon"]),
                    "name": feat.get("display_name") or location
                }

        return None

    except Exception as e:
        logger.error(f"Geocoding failed for {location}: {e}")
        return None

def get_route(source_coords, dest_coords):
    try:
        token = get_access_token()
        if not token: 
            return None

        url = f"https://apis.mappls.com/advancedmaps/v1/{token}/route_adv/driving/{source_coords['lng']},{source_coords['lat']};{dest_coords['lng']},{dest_coords['lat']}"
        params = {
            "geometries": "polyline",
            "overview": "full",
            "steps": "true"
        }
        
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("routes"):
                route = data["routes"][0]
                return {
                    "distance": route.get("distance"),
                    "duration": route.get("duration"),
                    "geometry": route.get("geometry"),
                    "steps": route.get("legs", [{}])[0].get("steps", [])
                }
        return None
    except Exception as e:
        logger.error(f"Error getting route: {e}")
        return None

def get_distance_info(source, destination):
    try:
        # Resolve coordinates
        source_coords = geocode(source)
        dest_coords = geocode(destination) # Parallel not easily doable here without threads/async, doing sequential for simplicity

        if not source_coords or not dest_coords:
            return None

        route = get_route(source_coords, dest_coords)
        if not route:
            return None

        distance_km = round(route["distance"] / 1000, 1)
        
        total_seconds = route["duration"]
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        
        duration_text = f"{hours} hour{'s' if hours != 1 else ''} {minutes} min" if hours > 0 else f"{minutes} minutes"

        return {
            "distanceKm": distance_km,
            "distanceText": f"{distance_km} km",
            "durationSeconds": route["duration"],
            "durationText": duration_text,
            "source": source_coords,
            "destination": dest_coords
        }
    except Exception as e:
        logger.error(f"Error getting distance info: {e}")
        return None

def search_places(lat, lng, query="tourist attraction", radius=5000):
    try:
        geoapify_key = os.getenv("PLACES_API_KEY") or os.getenv("GEOAPIFY_API_KEY")
        
        url = "https://api.geoapify.com/v2/places"
        params = {
            "categories": "tourism.sights,tourism.attraction,entertainment.museum,religion,natural",
            "filter": f"circle:{lng},{lat},{radius}",
            "bias": f"proximity:{lng},{lat}",
            "limit": 15,
            "apiKey": geoapify_key
        }
        
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            results = []
            for feat in data.get("features", []):
                props = feat["properties"]
                name = props.get("name") or props.get("formatted")
                if name:
                    results.append({
                        "name": name,
                        "address": props.get("address_line2") or props.get("formatted"),
                        "lat": props.get("lat"),
                        "lng": props.get("lon"),
                        "type": props.get("categories", ["point_of_interest"])[0],
                        "eLoc": None
                    })
            return results
        return []
    except Exception as e:
        logger.error(f"Error searching places (Geoapify): {e}")
        return []

def get_map_data(source, destination):
    try:
        source_coords = geocode(source)
        dest_coords = geocode(destination)

        if not source_coords or not dest_coords:
            return {
                "error": "Could not geocode source or destination",
                "source": source_coords,
                "destination": dest_coords
            }

        route = get_route(source_coords, dest_coords)
        places = search_places(dest_coords['lat'], dest_coords['lng'])

        return {
            "source": source_coords,
            "destination": dest_coords,
            "route": route,
            "places": places[:10]
        }
    except Exception as e:
        logger.error(f"Error getting map data: {e}")
        return {"error": str(e)}

# Aliases for compatibility
get_coordinates = geocode

def get_route_data(source_coords, dest_coords, access_token=None):
    return get_route(source_coords, dest_coords)
