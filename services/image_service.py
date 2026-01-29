"""
Image Service - Fetches place photos using Google Places API
"""
import os
import requests
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

# Simple in-memory cache to reduce API calls
_image_cache = {}


def get_place_image_from_google(place_name: str, destination: str) -> str | None:
    """
    Fetch image for a place using Google Places API.
    
    Args:
        place_name: Name of the place
        destination: Destination city for context
    
    Returns:
        Image URL or None
    """
    google_api_key = os.getenv("GOOGLE_API_KEY")
    
    if not google_api_key:
        logger.debug("Google API key not configured")
        return None

    cache_key = f"google:{place_name}:{destination}"
    if cache_key in _image_cache:
        return _image_cache[cache_key]

    try:
        # Search for the place using Text Search
        search_query = f"{place_name} {destination} India tourist"
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        
        search_response = requests.get(
            search_url,
            params={"query": search_query, "key": google_api_key},
            timeout=10
        )
        search_response.raise_for_status()
        search_data = search_response.json()

        if search_data.get("status") != "OK" or not search_data.get("results"):
            logger.debug(f"No Google Places results for: {place_name}")
            return None

        place = search_data["results"][0]

        # Check if the place has photos
        photos = place.get("photos", [])
        if not photos:
            logger.debug(f"No photos available for: {place_name}")
            return None

        # Get the photo URL using the photo_reference
        photo_reference = photos[0]["photo_reference"]
        photo_url = (
            f"https://maps.googleapis.com/maps/api/place/photo"
            f"?maxwidth=800&photo_reference={photo_reference}&key={google_api_key}"
        )

        # Cache and return the photo URL
        _image_cache[cache_key] = photo_url
        logger.info(f"✓ Found Google image for: {place_name}")
        return photo_url

    except requests.RequestException as e:
        logger.error(f"Error fetching Google Places image: {e}")
        return None


def get_place_images(places: list, destination: str) -> dict:
    """
    Fetch images for multiple places in parallel.
    
    Args:
        places: List of place objects with 'name' key
        destination: Destination city
    
    Returns:
        Dict mapping place names to image URLs
    """
    image_map = {}
    
    def fetch_image(place):
        name = place.get("name", "")
        image_url = get_place_image_from_google(name, destination)
        return name, image_url

    # Use thread pool for parallel fetching
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(fetch_image, place) for place in places]
        
        for future in as_completed(futures):
            try:
                name, image_url = future.result()
                image_map[name] = image_url
            except Exception as e:
                logger.error(f"Error in parallel image fetch: {e}")

    return image_map
