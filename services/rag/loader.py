"""
Document Loader - Loads and chunks text files from knowledge_docs
See: /docs/rag_pipeline.md for chunking strategy details.
"""
import os
import logging

logger = logging.getLogger(__name__)

# Knowledge docs directory
DOCS_DIR = os.path.join(os.path.dirname(__file__), "knowledge_docs")


def load_documents() -> list:
    """
    Loads and chunks text files from knowledge_docs.
    
    Returns:
        List of document chunks: [{"id": str, "text": str, "metadata": dict}, ...]
    """
    logger.info(f"Loading docs from {DOCS_DIR}...")

    if not os.path.exists(DOCS_DIR):
        logger.error("Knowledge docs directory not found")
        return []

    # Get all .txt files
    files = [f for f in os.listdir(DOCS_DIR) if f.endswith(".txt")]
    documents = []

    for file in files:
        file_path = os.path.join(DOCS_DIR, file)
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except IOError as e:
            logger.error(f"Error reading {file}: {e}")
            continue

        # Simple chunking by newline for these small files
        # In pro version, use a TokenTextSplitter
        chunks = [line.strip() for line in content.split("\n") if len(line.strip()) > 5]

        for index, chunk in enumerate(chunks):
            documents.append({
                "id": f"{file}_{index}",
                "text": chunk,
                "metadata": {"source": file}
            })

    logger.info(f"Loaded {len(documents)} chunks from {len(files)} files.")
    return documents
