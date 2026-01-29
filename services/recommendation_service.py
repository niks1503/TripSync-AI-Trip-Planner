"""
Recommendation Service - Wrapper for ML-based recommendations
"""
import os
import json
import subprocess
import logging

logger = logging.getLogger(__name__)

# Path to ML script
ML_SCRIPT_PATH = os.path.join(
    os.path.dirname(__file__), 
    "..", 
    "ml_engine", 
    "run_recommendations.py"
)


def get_ml_recommendations(preferences: list, destination: str) -> list:
    """
    Get ML-based recommendations for a destination.
    
    Args:
        preferences: List of user preference strings
        destination: Target destination name
    
    Returns:
        List of recommended places or empty list on error
    """
    try:
        logger.info("🧠 Calling ML Engine for Recommendations...")
        
        # Prepare payload
        payload = json.dumps({
            "preferences": preferences,
            "destination": destination
        })

        # Run Python ML script
        result = subprocess.run(
            ["python3", ML_SCRIPT_PATH],
            input=payload,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            logger.error(f"ML script exited with code {result.returncode}")
            logger.error(result.stderr)
            return []

        # Parse results
        try:
            results = json.loads(result.stdout)
            if isinstance(results, dict) and results.get("error"):
                logger.error(f"ML Engine Error: {results['error']}")
                return []
            
            logger.info(f"✅ ML returned {len(results)} recommendations")
            return results
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse ML response: {e}")
            return []

    except subprocess.TimeoutExpired:
        logger.error("ML script timed out")
        return []
    except Exception as e:
        logger.error(f"Error calling ML engine: {e}")
        return []
