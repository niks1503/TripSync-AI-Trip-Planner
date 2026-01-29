"""
Query RAG - Interface for querying the RAG system
Rationale: Reduces Hallucination by grounding LLM (See /docs/rag_pipeline.md)
"""
import asyncio
import logging
from .vector_store import get_vector_store

logger = logging.getLogger(__name__)


async def query_rag_async(query: str) -> str:
    """
    Queries the RAG system for relevant context (async version).
    
    Args:
        query: Search query
    
    Returns:
        Formatted relevant snippets or error message
    """
    try:
        logger.info(f'RAG Query: "{query}"')
        store = get_vector_store()
        results = await store.similarity_search(query, k=3)

        if not results:
            return "No relevant information found in knowledge base."

        # Format as plain text snippets
        top_snippets = "\n".join(
            f"[{r['metadata']['source']}] {r['text']}" 
            for r in results
        )

        return top_snippets

    except Exception as e:
        logger.error(f"RAG Query Error: {e}")
        return "Error fetching RAG context."


def query_rag(query: str) -> str:
    """
    Queries the RAG system for relevant context (sync wrapper).
    
    Args:
        query: Search query
    
    Returns:
        Formatted relevant snippets or error message
    """
    try:
        # Try to get the running event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Create a new loop in a thread if needed
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, query_rag_async(query))
                return future.result()
        else:
            return loop.run_until_complete(query_rag_async(query))
    except RuntimeError:
        # No event loop, create one
        return asyncio.run(query_rag_async(query))
