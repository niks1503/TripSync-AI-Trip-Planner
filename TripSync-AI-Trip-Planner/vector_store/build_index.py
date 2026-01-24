import json
import os
import pickle
import numpy as np
try:
    import faiss
except ImportError:
    print("FAISS not found. Install with: pip install faiss-cpu")
    faiss = None

from embeddings import EmbeddingGenerator

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '../data/processed/database.json')
INDEX_DIR = os.path.join(BASE_DIR, 'faiss_index')

def load_data():
    if not os.path.exists(DATA_PATH):
        print(f"Data not found at {DATA_PATH}. Using dummy data for structure check.")
        return []
        
    with open(DATA_PATH, 'r') as f:
        return json.load(f)

def build_index():
    print("Initializing Vector Store Builder...")
    
    # 1. Load Data
    data = load_data()
    if not data:
        print("No data to index.")
        # Create dummy data for structure verification if real data missing
        data = [{'place_id': '1', 'name': 'Dummy', 'description': 'Test place', 'category': 'Test'}]

    # 2. Prepare Corpus
    corpus = []
    ids = []
    for item in data:
        # Combine relevant fields for semantic search
        text = f"{item.get('name', '')} {item.get('category', '')} {item.get('description', '')}"
        corpus.append(text)
        ids.append(item.get('place_id', '0'))

    # 3. Generate Embeddings
    print(f"Generating embeddings for {len(corpus)} items...")
    embedder = EmbeddingGenerator()
    embeddings = embedder.generate(corpus)
    
    # 4. Build FAISS Index
    if faiss:
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(embeddings)
        print(f"Index built with {index.ntotal} vectors.")
        
        # 5. Save Index
        if not os.path.exists(INDEX_DIR):
            os.makedirs(INDEX_DIR)
            
        faiss.write_index(index, os.path.join(INDEX_DIR, 'places.index'))
        
        # Save Metadata (ID mapping) separately
        with open(os.path.join(INDEX_DIR, 'metadata.pkl'), 'wb') as f:
            pickle.dump({'ids': ids, 'data': data}, f)
            
        print(f"Index saved to {INDEX_DIR}")
    else:
        print("Skipping FAISS index creation (FAISS not installed).")

if __name__ == "__main__":
    build_index()
