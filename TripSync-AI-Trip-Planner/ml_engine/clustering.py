import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

class PlaceClustering:
    def __init__(self, n_clusters=5):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.kmeans = None
        
    def train(self, places_data):
        """
        Expects a list of dicts with 'lat', 'lon'.
        Automatically determines optimal k if data is small.
        """
        df = pd.DataFrame(places_data)
        
        # Filter valid coordinates
        df = df.dropna(subset=['lat', 'lon'])
        
        if len(df) < self.n_clusters:
            self.n_clusters = max(1, len(df))
            
        self.kmeans = KMeans(n_clusters=self.n_clusters, random_state=42, n_init=10)
        
        # Feature Engineering: Use Lat/Lon for geographical clustering
        # Multiply Latitude by 111 (approx km per degree) for better scaling
        features = df[['lat', 'lon']].copy()
        
        self.scaler.fit(features)
        scaled_features = self.scaler.transform(features)
        
        # Fit model
        self.kmeans.fit(scaled_features)
        
        # Assign clusters to original data
        # We need to map back to original indices
        labels = self.kmeans.predict(scaled_features)
        
        # Create a map of place_id -> cluster_id
        cluster_map = {}
        for idx, row in df.iterrows():
            # Adjust index if df was filtered
            # Assuming places_data has unique place_id
            pid = row.get('place_id')
            if pid:
                cluster_map[str(pid)] = int(labels[idx])
                
        return cluster_map

    def predict(self, lat, lon):
        if self.kmeans is None:
            return 0
        scaled = self.scaler.transform([[lat, lon]])
        return int(self.kmeans.predict(scaled)[0])
