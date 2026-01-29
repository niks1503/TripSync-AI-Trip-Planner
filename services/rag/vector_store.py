"""
Vector Store - Embeddings and similarity search for RAG
See: /docs/rag_pipeline.md - Section 4 (Retrieval Flow)
"""
import os
import math
import random
import requests
import logging
from .loader import load_documents

logger = logging.getLogger(__name__)

# Module-level state
_vector_index = []
_is_initialized = False


def cosine_similarity(vec_a: list, vec_b: list) -> float:
    """Compute cosine similarity between two vectors."""
    if not vec_a or not vec_b:
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    
    if mag_a == 0 or mag_b == 0:
        return 0.0
    
    return dot_product / (mag_a * mag_b)


def get_embedding(text: str) -> list:
    """
    Generate embedding using OpenRouter API.
    Falls back to random vectors if API fails (for demo purposes).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/embeddings",
            json={
                "model": "openai/text-embedding-3-small",
                "input": text
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]
    
    except Exception as e:
        logger.error(f"Embedding Error (using random fallback): {e}")
        # Fallback for demo so app doesn't crash if API fails
        return [random.random() for _ in range(1536)]


def initialize_vector_store():
    """Initialize the vector store with document embeddings."""
    global _vector_index
    
    docs = load_documents()
    _vector_index = []

    logger.info("Vectorizing knowledge base...")

    # Process sequentially to avoid rate limits
    for doc in docs:
        embedding = get_embedding(doc["text"])
        _vector_index.append({
            **doc,
            "embedding": embedding
        })

    logger.info(f"Vector Store Ready with {len(_vector_index)} vectors.")


class VectorStore:
    """Vector store with similarity search capability."""
    
    async def similarity_search(self, query: str, k: int = 3) -> list:
        """
        Search for similar documents.
        
        Args:
            query: Search query text
            k: Number of results to return
        
        Returns:
            List of top-k most similar documents
        """
        query_embedding = get_embedding(query)

        # Calculate scores
        results = []
        for doc in _vector_index:
            score = cosine_similarity(query_embedding, doc.get("embedding", []))
            results.append({**doc, "score": score})

        # Sort descending by score
        results.sort(key=lambda x: x["score"], reverse=True)

        # Return top k
        return results[:k]


def get_vector_store() -> VectorStore:
    """
    Get the vector store instance, initializing if needed.
    
    Returns:
        VectorStore instance
    """
    global _is_initialized
    
    if not _is_initialized:
        initialize_vector_store()
        _is_initialized = True
    
    return VectorStore()
