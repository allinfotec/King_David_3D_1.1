import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCharacterPortrait() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment variables (checked GEMINI_API_KEY, API_KEY, GOOGLE_API_KEY)");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Create a realistic 3D game character portrait, designed for a video game UI.
  Young male character inspired by a biblical medieval shepherd.
  Red hair, light beard or clean face.
  Simple peasant clothing made of natural fabrics (beige/brown).
  Humble and strong appearance.
  Semi-realistic to realistic style.
  Soft, realistic lighting.
  Neutral background suitable for a game HUD portrait.`;

  try {
    console.log("Generating character portrait...");
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/png',
      },
    });

    const imageBytes = response.generatedImages[0].image.imageBytes;
    const buffer = Buffer.from(imageBytes, 'base64');
    
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const outputPath = path.join(publicDir, 'character_portrait.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Character portrait saved to ${outputPath}`);
    
  } catch (error) {
    console.error("Error generating image:", error);
    // Fallback if generation fails (e.g. model not available or quota)
    // We will just log error and exit. The UI will handle missing image gracefully or we can use a placeholder.
  }
}

generateCharacterPortrait();
