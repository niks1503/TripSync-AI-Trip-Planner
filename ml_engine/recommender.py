import pandas as pd
import numpy as np
import os
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from ml_engine.clustering import PlaceClustering

class ContentRecommender:
    def __init__(self):
        self.tfidf = TfidfVectorizer(stop_words='english')
        self.tfidf_matrix = None
        self.indices = None
        self.df = None
        self.clustering = PlaceClustering(n_clusters=5)
        self.cluster_map = {}

    def train(self, places_data):
        self.df = pd.DataFrame(places_data)
        
        # 1. Text Features (Handle missing columns)
        # Attractions might not have 'category', so we focus on name + description
        content_parts = []
        if 'category' in self.df.columns:
            content_parts.append(self.df['category'].fillna(''))
            
        content_parts.append(self.df['spot_name'].fillna('') if 'spot_name' in self.df.columns else self.df['place_name'].fillna(''))
        content_parts.append(self.df['description'].fillna(''))
        
        # Join all available text parts
        self.df['content'] = pd.concat(content_parts, axis=1).apply(lambda x: ' '.join(x), axis=1)
            
        self.tfidf_matrix = self.tfidf.fit_transform(self.df['content'])
        
        # Reset index to ensure we can look up by position
        self.df = self.df.reset_index(drop=True)
        
        return self

    def _haversine(self, lat1, lon1, lat2, lon2):
        if pd.isnull(lat1) or pd.isnull(lat2) or lat1 is None or lat2 is None: 
            return 1000 # Max distance penalty
        R = 6371
        phi1, phi2 = np.radians(lat1), np.radians(lat2)
        dphi = np.radians(lat2 - lat1)
        dlambda = np.radians(lon2 - lon1)
        a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlambda/2)**2
        return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

    def recommend(self, user_profile, context, top_n=15):
        """
        Multi-Objective Recommendation Logic
        context: { user_lat, user_lon, budget, days }
        """
        if self.tfidf_matrix is None or self.df.empty: return []

        # 1. Preference Score (TF-IDF)
        user_tfidf = self.tfidf.transform([user_profile])
        cosine_sim = linear_kernel(user_tfidf, self.tfidf_matrix).flatten()
        
        results = []
        
        for idx, row in self.df.iterrows():
            # --- Feature 1: Preference ---
            pref_score = cosine_sim[idx]
            
            # --- Feature 2: Distance ---
            # Attractions often lack lat/lon in this specific dataset struct, so we might skip or use parent
            dist_score = 0
            if context.get('user_lat') and row.get('lat'):
                d = self._haversine(context['user_lat'], context['user_lon'], row.get('lat'), row.get('lon'))
                dist_score = np.exp(-(d/50)**2) # Gaussian decay
            else:
                dist_score = 0.5 # Neutral if no location
                
            # --- Feature 3: Budget ---
            # Parsing dining/accomodation costs is complex, simple heuristic for now
            budget_score = 1.0
            
            # --- Score Aggregation ---
            # Weights: Pref(0.6) + Dist(0.2) + Budget(0.2)
            # Increased preference weight since distance is often missing for attractions
            final_score = (pref_score * 0.6) + (dist_score * 0.2) + (budget_score * 0.2)
            
            results.append({
                **row.to_dict(),
                'ml_score': float(final_score),
                'scores': {
                    'preference': float(pref_score),
                    'distance': float(dist_score)
                }
            })
            
        # Sort and Pick
        results = sorted(results, key=lambda x: x['ml_score'], reverse=True)
        top_picks = results[:top_n]
            
        return top_picks

    def allocate_itinerary(self, places, days):
        """
        Groups selected places into 'days'.
        If lat/lon exists, use clustering. Otherwise, simple chunking.
        """
        if not places or days < 1: return {}
        
        # Check if we have valid coordinates for at least 50% of places
        has_coords = sum(1 for p in places if p.get('lat') and p.get('lon'))
        use_clustering = has_coords > (len(places) / 2)
        
        day_groups = {}
        
        if use_clustering:
            try:
                coords = [[p.get('lat', 0), p.get('lon', 0)] for p in places]
                k = min(len(places), days)
                # Lazy import to avoid circular dependency if called earlier
                from sklearn.cluster import KMeans
                day_kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                labels = day_kmeans.fit_predict(coords)
                
                for idx, label in enumerate(labels):
                    day_num = int(label) + 1
                    if day_num not in day_groups: day_groups[day_num] = []
                    day_groups[day_num].append(places[idx])
                return day_groups
            except Exception as e:
                pass # Fallback to chunking
                
        # Fallback: Simple chunking
        # Distribute places evenly across days
        items_per_day = int(np.ceil(len(places) / days))
        for i in range(days):
            start_idx = i * items_per_day
            end_idx = start_idx + items_per_day
            day_slice = places[start_idx:end_idx]
            if day_slice:
                day_groups[i+1] = day_slice
                
        return day_groups

def get_recommendations(destination, preferences, days=3, budget=5000):
    try:
        # Resolve path relative to this file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(base_dir, '../data/processed/database.json')

        if not os.path.exists(data_path):
            return []

        with open(data_path, 'r', encoding='utf-8') as f:
            all_places = json.load(f)
            
        destination_obj = next((p for p in all_places if p['place_name'].lower() == destination.lower()), None)
        
        if not destination_obj:
            return []
            
        attractions_data = destination_obj.get('attractions', [])
        if not attractions_data:
            return []
            
        recommender = ContentRecommender()
        recommender.train(attractions_data)
        
        context = {
            'user_lat': None, 
            'user_lon': None,
            'budget': budget,
            'days': days
        }
        
        # User profile is just the preferences string for now
        user_profile = " ".join(preferences) if isinstance(preferences, list) else str(preferences)
        
        return recommender.recommend(user_profile, context)
        
    except Exception as e:
        print(f"Error getting recommendations: {e}")
        return []
