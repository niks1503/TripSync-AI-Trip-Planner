from flask import Flask, send_from_directory, render_template, request, jsonify, Response, stream_with_context
import os
import json
import logging
from dotenv import load_dotenv

# Import Services
from services.llm_service import call_llm
from services.prompt_builder import build_prompt
from services.places_service import get_places_by_name, get_coordinates
from services.mappls_service import get_map_data, get_access_token, get_distance_info
from services.local_db_service import load_local_db, upsert_destination, build_destination_from_api, find_destination, save_local_db
from services.image_service import get_place_images

from ml_engine.recommender import get_recommendations

load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
PORT = 5000

# Validation Checks
required_env_vars = ["GEOAPIFY_API_KEY", "GROQ_API_KEY"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]

if missing_vars:
    logger.warning(f"⚠️  Missing Environment Variables: {', '.join(missing_vars)}")
else:
    logger.info("✅ All required API keys configured")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/agent')
def agent():
    return render_template('agent.html')

@app.route('/itinerary-display-pro.html')
def itinerary_display_pro():
    return render_template('itinerary-display-pro.html')

@app.route('/itinerary-display.html')
def itinerary_display():
    return render_template('itinerary-display.html')

@app.route('/api/plan-trip', methods=['POST'])
def plan_trip():
    data = request.json
    destination = data.get('destination')
    budget = data.get('budget')
    people = data.get('people')
    days = data.get('days')
    source = data.get('source')
    transport = data.get('transport')
    preferences = data.get('preferences', [])
    
    if not all([destination, budget, people, days, source]):
        return jsonify({"message": "All fields are required"}), 400

    logger.info(f"🚀 Plan-Trip Request: {destination} ({days} days)")

    # Stream response
    def generate():
        try:
            # 1. Load DB
            all_places = load_local_db()
            
            # 2. Context Gathering
            coords = get_coordinates(destination)
            
            local_dest = find_destination(all_places, destination)
            ranked_places = []
            
            if local_dest: 
                # Use local attractions if available
                 if local_dest.get("attractions"):
                    ranked_places = local_dest["attractions"]
            elif coords:
                 # Fetch fresh
                 logger.info(f"🆕 {destination} not in DB. Fetching from API...")
                 api_places = get_places_by_name(destination)
                 new_dest = build_destination_from_api({
                    "destinationName": destination,
                    "coords": coords,
                    "places": api_places
                 }, all_places)
                 
                 result = upsert_destination(all_places, new_dest)
                 all_places = result["db"]
                 if result["created"] or result["updated"]:
                     save_local_db(all_places)
                 
                 ranked_places = new_dest.get("attractions", [])

            # 3. Distance Info
            distance_info = get_distance_info(source, destination)

            # 4. ML Recommendation
            logger.info("🧠 Running ML Recommender...")
            try:
                ml_recs = get_recommendations(destination, preferences, days, budget)
                if ml_recs:
                    logger.info(f"✅ ML Recommender returned {len(ml_recs)} places")
                    ranked_places = ml_recs
                else:
                    logger.info("⚠️ ML Recommender returned no results, using default ranking")
            except Exception as ml_err:
                logger.error(f"❌ ML Recommender Error: {ml_err}")
                # Fallback to default ranking if ML fails

            # 4. Prompt Construction
            # Format preferences
            user_prefs_str = ", ".join(preferences) if preferences else "General sightseeing"
            
            prompt_context = {
                "places": ranked_places,
                "distanceInfo": distance_info
            }
            
            prompt = build_prompt({
                "destination": destination,
                "source": source,
                "budget": budget,
                "people": people,
                "days": days,
                "transportMode": transport,
                "preferences": user_prefs_str
            }, prompt_context)
            
            logger.info("Calling LLM...")
            
            # 5. LLM Call
            itinerary = call_llm(prompt)
            yield itinerary

        except Exception as e:
            logger.error(f"Error generating itinerary: {e}")
            yield json.dumps({"error": str(e)})

    return Response(stream_with_context(generate()), content_type='text/plain; charset=utf-8')

@app.route('/api/map-data', methods=['POST'])
def map_data_route():
    data = request.json
    source = data.get('source')
    destination = data.get('destination')
    
    if not source or not destination:
        return jsonify({"message": "Source and destination required"}), 400
        
    try:
        map_info = get_map_data(source, destination)
        token = get_access_token()
        
        map_info["accessToken"] = token
        return jsonify(map_info)
    except Exception as e:
        logger.error(f"Error getting map data: {e}")
        return jsonify({"message": "Error fetching map data"}), 500

@app.route('/api/place-images', methods=['POST'])
def place_images_route():
    try:
        data = request.json
        places = data.get('places', [])
        destination = data.get('destination', '')
        
        if not places:
            return jsonify({"images": {}})
        
        # Fetch images using the image service
        image_map = get_place_images(places, destination)
        return jsonify({"images": image_map})
    except Exception as e:
        logger.error(f"Error fetching place images: {e}")
        return jsonify({"images": {}})

if __name__ == '__main__':
    logger.info(f"🚀 Server running on http://localhost:{PORT}")
    app.run(port=PORT, debug=True)
