import { getVectorStore } from './vectorStore.js';

/**
 * Queries the RAG system for relevant context.
 * Rationale: Reduces Hallucination by grounding LLM (See /docs/rag_pipeline.md)
 */
export async function queryRag(query) {
    try {
        console.log(`RAG Query: "${query}"`);
        const store = await getVectorStore();
        const results = await store.similaritySearch(query, 3);

        if (results.length === 0) {
            return "No relevant information found in knowledge base.";
        }

        // Format as plain text snippets as requested
        const topSnippets = results.map(r => `[${r.metadata.source}] ${r.text}`).join('\n');

        return topSnippets;
    } catch (error) {
        console.error("RAG Query Error:", error);
        return "Error fetching RAG context.";
    }
}
