import sys
import json
import os
import pandas as pd
from recommender import ContentRecommender

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '../data/processed/database.json')

def main():
    try:
        # 1. Read Input from Stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input provided"}))
            return
            
        request = json.loads(input_data)
        
        # Parse Context
        preferences = request.get('preferences', '')
        destination_name = request.get('destination', '')
        
        context = {
            'user_lat': request.get('user_lat'),
            'user_lon': request.get('user_lon'),
            'budget': request.get('budget', 5000),
            'days': request.get('days', 3)
        }
        
        # 2. Load Data
        if not os.path.exists(DATA_PATH):
             print(json.dumps({"error": "Database not found"}))
             return

        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            all_places = json.load(f)

        # 3. Filter by Destination
        # The DB is a list of destinations, each containing 'attractions'
        destination_obj = None
        if destination_name:
            destination_obj = next((p for p in all_places if p['place_name'].lower() == destination_name.lower()), None)
            
        if not destination_obj:
            # Fallback: If no specific destination found, maybe we act on all (but likely not what's needed)
            print(json.dumps({"error": f"Destination '{destination_name}' not found in database"}))
            return

        attractions_data = destination_obj.get('attractions', [])
        
        if not attractions_data:
             print(json.dumps({"error": "No attractions found for this destination"}))
             return

        # 4. Train Model on ATTRACTIONS
        recommender = ContentRecommender()
        recommender.train(attractions_data)

        # 5. Get Recommendations
        recommendations = recommender.recommend(preferences, context, top_n=15)
        
        # 6. Day-Wise Allocation (Note: Attractions might lack lat/lon, so clustering might fallback)
        itinerary = recommender.allocate_itinerary(recommendations, context['days'])
        
        # 7. Output JSON structure
        response = {
            "meta": {
                "count": len(recommendations),
                "strategy": "Content-Based Filtering on Attractions"
            },
            "recommendations": recommendations,
            "itinerary": itinerary
        }
        print(json.dumps(response))

    except Exception as e:
        # returns full stacktrace for debugging
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

if __name__ == "__main__":
    main()
