import numpy as np
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("SentenceTransformers not found. Install with: pip install sentence-transformers")
    SentenceTransformer = None

class EmbeddingGenerator:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model = None
        if SentenceTransformer:
            try:
                self.model = SentenceTransformer(model_name)
            except Exception as e:
                print(f"Failed to load model: {e}")

    def generate(self, text_list):
        if not self.model:
            # Fallback for dev/testing without heavy libs
            print("Warning: Using dummy embeddings (random noise).")
            return np.random.rand(len(text_list), 384).astype('float32') # 384 is standard for MiniLM
        
        return self.model.encode(text_list)
