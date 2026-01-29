import os
import json
import logging

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "../data/processed/database.json")

def load_local_db(db_path=DEFAULT_DB_PATH):
    if not os.path.exists(db_path):
        return []
    try:
        with open(db_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"Failed to load DB: {e}")
        return []

def save_local_db(db, db_path=DEFAULT_DB_PATH):
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with open(db_path, 'w', encoding='utf-8') as f:
            json.dump(db, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save DB: {e}")

def safe_lower(s):
    return str(s).strip().lower() if s else ""

def find_destination(db, destination_name):
    d = safe_lower(destination_name)
    if not d: return None
    
    # Exact match
    for p in db:
        if safe_lower(p.get("place_name")) == d:
            return p
            
    # Substring match
    for p in db:
        if d in safe_lower(p.get("place_name")):
            return p
            
    return None

def get_max_numeric_id(items, key):
    max_val = 0
    for item in items or []:
        raw = item.get(key)
        try:
            val = int(raw)
            if val > max_val:
                max_val = val
        except (ValueError, TypeError):
            continue
    return max_val

def upsert_destination(db, destination):
    if not isinstance(db, list): db = []
    
    name_key = safe_lower(destination.get("place_name"))
    if not name_key:
        return {"db": db, "destination": None, "created": False, "updated": False}

    idx = -1
    for i, p in enumerate(db):
        if safe_lower(p.get("place_name")) == name_key:
            idx = i
            break
            
    if idx >= 0:
        existing = db[idx]
        merged = existing.copy()
        merged.update(destination)
        # Preserve existing attractions if not overwritten
        if "attractions" not in destination:
             merged["attractions"] = existing.get("attractions", [])
             
        db[idx] = merged
        return {"db": db, "destination": merged, "created": False, "updated": True}

    # Insert new
    max_place_id = get_max_numeric_id(db, "place_id")
    destination["place_id"] = destination.get("place_id", str(max_place_id + 1))
    destination["state"] = destination.get("state", "Unknown")
    destination["description"] = destination.get("description", "")
    destination["attractions"] = destination.get("attractions", [])
    
    db.append(destination)
    return {"db": db, "destination": destination, "created": True, "updated": False}

def build_destination_from_api(data, existing_db):
    destination_name = data.get("destinationName")
    coords = data.get("coords")
    places = data.get("places", [])
    
    max_place_id = get_max_numeric_id(existing_db, "place_id")
    
    # Calculate max spot id
    max_spot_id = 0
    for dest in existing_db:
        for attr in dest.get("attractions", []):
            sid = get_max_numeric_id([attr], "spot_id")
            if sid > max_spot_id: max_spot_id = sid

    place_id = str(max_place_id + 1)
    
    attractions = []
    for i, p in enumerate(places[:20]):
        if not p: continue
        name = p.get("name") or p.get("place_name")
        if not name: continue
        
        attractions.append({
            "spot_id": str(max_spot_id + 1 + i),
            "place_id": place_id,
            "spot_name": name,
            "description": p.get("address") or p.get("category") or "Attraction",
            "lat": p.get("lat"),
            "lon": p.get("lon"),
            "dining": [],
            "accommodation": []
        })

    return {
        "place_id": place_id,
        "place_name": destination_name,
        "lat": coords.get("lat") if coords else None,
        "lon": coords.get("lon") if coords else None,
        "state": "Unknown",
        "description": "Auto-added from live APIs",
        "attractions": attractions
    }
