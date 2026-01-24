import json
import os
import pandas as pd
import pickle
from clustering import PlaceClustering
from recommender import ContentRecommender

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '../data/processed/database.json')
MODEL_DIR = os.path.join(BASE_DIR, 'models')

def load_data():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Processed data not found at {DATA_PATH}. Run ingestion first.")
    
    with open(DATA_PATH, 'r') as f:
        data = json.load(f)
    return data

def train():
    print("Loading data...")
    print(f"Reading from: {DATA_PATH}")
    
    try:
        raw_data = load_data()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return

    # Flatten data for ML
    places_list = []
    for place in raw_data:
        places_list.append({
            'name': place['place_name'],
            'lat': 19.0760, # Placeholder defaults if missing in raw txt
            'lon': 72.8777,
            'category': 'Tourist Attraction', # Default
            'description': place.get('description', '')
        })
        
    print(f"Training on {len(places_list)} places...")
    
    # 1. Train Clustering Model
    print("Training K-Means Clustering...")
    # Add dummy lat/lon if not properly geocoded yet, just to show it works
    # In real pipeline, ingestor.js should ensure these exist
    clustering = PlaceClustering(n_clusters=min(5, len(places_list)))
    # For demo, generate fake lat/lon if missing (since places.txt didn't have coords)
    for i, p in enumerate(places_list):
        p['lat'] = 19.0 + (i * 0.01) 
        p['lon'] = 73.0 + (i * 0.01)

    clustered_df = clustering.train(places_list)
    print("Clustering complete.")
    print(clustered_df[['name', 'cluster']].head())

    # 2. Train Recommender
    print("Training Content Recommender...")
    recommender = ContentRecommender()
    recommender.train(places_list)
    print("Recommender trained.")
    
    # Test Recommendation
    test_place = places_list[0]['name']
    print(f"Recommendations for '{test_place}':")
    recs = recommender.get_recommendations(test_place)
    for r in recs:
        print(f"- {r['name']}")

    # Save Models (Optional - placeholder for pickle logic)
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    with open(os.path.join(MODEL_DIR, 'kmeans.pkl'), 'wb') as f:
        pickle.dump(clustering, f)
        
    with open(os.path.join(MODEL_DIR, 'tfidf.pkl'), 'wb') as f:
        pickle.dump(recommender, f)
        
    print(f"Models saved to {MODEL_DIR}")

if __name__ == "__main__":
    train()
