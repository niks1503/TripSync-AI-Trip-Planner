import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getMLRecommendations(preferences, allPlaces, destination) {
    return new Promise((resolve, reject) => {
        // console.log("🧠 Calling ML Engine for Recommendations...");

        const pyScript = path.join(__dirname, "../ml_engine/run_recommendations.py");
        const pythonProcess = spawn("python3", [pyScript]);

        let dataString = "";
        let errorString = "";

        // Prepare payload
        // We send preferences and destination.
        const payload = JSON.stringify({ preferences, destination });

        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            errorString += data.toString();
        });

        pythonProcess.on("close", (code) => {
            if (code !== 0) {
                console.error(`ML script exited with code ${code}`);
                console.error(errorString);
                resolve([]); // Fallback to empty (will trigger heuristic fallback)
            } else {
                try {
                    const results = JSON.parse(dataString);
                    if (results.error) {
                        console.error("ML Engine Error:", results.error);
                        resolve([]);
                    } else {
                        // console.log(`✅ ML returned ${results.length} recommendations`);
                        resolve(results);
                    }
                } catch (e) {
                    console.error("Failed to parse ML response:", e);
                    resolve([]);
                }
            }
        });
    });
}
