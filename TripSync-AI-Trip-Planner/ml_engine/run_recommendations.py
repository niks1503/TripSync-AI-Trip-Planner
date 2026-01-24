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
            places_data = json.load(f)

        # 3. Train Model
        recommender = ContentRecommender()
        recommender.train(places_data)

        # 4. Get Recommendations (Trip-Aware)
        recommendations = recommender.recommend(preferences, context, top_n=15)
        
        # 5. Day-Wise Allocation
        itinerary = recommender.allocate_itinerary(recommendations, context['days'])
        
        # 6. Output JSON structure
        response = {
            "meta": {
                "count": len(recommendations),
                "strategy": "Multi-Objective + Clustering"
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
