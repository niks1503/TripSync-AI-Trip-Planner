import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from clustering import PlaceClustering

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
        
        # 1. Text Features
        self.df['content'] = self.df['category'] + " " + self.df['description'].fillna('')
        self.tfidf_matrix = self.tfidf.fit_transform(self.df['content'])
        self.indices = pd.Series(self.df.index, index=self.df['place_name']).drop_duplicates()
        
        # 2. Train Clustering
        if 'lat' in self.df.columns and 'lon' in self.df.columns:
             self.cluster_map = self.clustering.train(places_data)
             self.df['cluster'] = self.df['place_id'].astype(str).map(self.cluster_map).fillna(-1)
        
        return self

    def _haversine(self, lat1, lon1, lat2, lon2):
        if pd.isnull(lat1) or pd.isnull(lat2): return 1000 # Max distance penalty
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
        if self.tfidf_matrix is None: return []

        # 1. Preference Score (TF-IDF)
        user_tfidf = self.tfidf.transform([user_profile])
        cosine_sim = linear_kernel(user_tfidf, self.tfidf_matrix).flatten()
        
        results = []
        selected_categories = set()
        
        for idx, row in self.df.iterrows():
            # --- Feature 1: Preference ---
            pref_score = cosine_sim[idx]
            
            # --- Feature 2: Distance ---
            dist_score = 0
            if context.get('user_lat'):
                d = self._haversine(context['user_lat'], context['user_lon'], row.get('lat'), row.get('lon'))
                dist_score = np.exp(-(d/50)**2) # Gaussian decay, sigma=50km
            else:
                dist_score = 0.5 # Neutral if no location
                
            # --- Feature 3: Budget ---
            budget_score = 1.0
            place_cost = 2000 # Default if unknown
            user_budget = float(context.get('budget', 5000))
            if place_cost > user_budget:
                budget_score = 0.0
            
            # --- Feature 4: Time Feasibility ---
            time_score = 1.0
            # Simple heuristic: penalize if trip is short (1-2 days) but place is remote
            if context.get('days', 3) < 2 and dist_score < 0.2:
                time_score = 0.5

            # --- Score Aggregation ---
            # Weights: Pref(0.4) + Dist(0.3) + Time(0.2) + Budget(0.1)
            final_score = (pref_score * 0.4) + (dist_score * 0.3) + (time_score * 0.2) + (budget_score * 0.1)
            
            # --- Feature 5: Diversity Penalty ---
            if row['category'] in selected_categories:
                final_score *= 0.8 # Penalize repeat categories
            
            results.append({
                **row.to_dict(),
                'ml_score': float(final_score),
                'scores': {
                    'preference': float(pref_score),
                    'distance': float(dist_score),
                    'feasibility': float(time_score)
                }
            })
            
        # Sort and Pick
        results = sorted(results, key=lambda x: x['ml_score'], reverse=True)
        top_picks = results[:top_n]
        
        # Track categories for diversity in next iteration (if simulated)
        for p in top_picks:
            selected_categories.add(p['category'])
            
        return top_picks

    def allocate_itinerary(self, places, days):
        """
        Groups selected places into 'days' based on geographic clustering.
        """
        if not places or days < 1: return {}
        
        # Extract lat/lon for clustering
        coords = [[p.get('lat', 0), p.get('lon', 0)] for p in places]
        
        # If we have valid coords, cluster them into 'days'
        day_groups = {}
        try:
            # k = days (or less if fewer places)
            k = min(len(places), days)
            day_kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = day_kmeans.fit_predict(coords)
            
            # Group by label
            for idx, label in enumerate(labels):
                day_num = int(label) + 1
                if day_num not in day_groups: day_groups[day_num] = []
                day_groups[day_num].append(places[idx])
                
        except Exception as e:
            # Fallback: Simple chunking
            chunk_size = (len(places) // days) + 1
            for i in range(days):
                day_groups[i+1] = places[i*chunk_size : (i+1)*chunk_size]
                
        # Sort days to ensure Day 1 is closest to user start ? (Optional optimization)
        return day_groups
