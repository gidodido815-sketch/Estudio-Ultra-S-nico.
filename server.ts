import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a limit to handle base64 easily if needed
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// Initialize Gemini SDK with lazy check and correct User-Agent
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("La clave GEMINI_API_KEY no está configurada. Por favor, añádela en la sección Settings > Secrets de AI Studio.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Endpoint to enhance text script using Gemini
app.post("/api/gemini/enhance", async (req, res) => {
  try {
    const { text, mood, duration } = req.body;
    if (!text) {
      return res.status(400).json({ error: "El texto es obligatorio." });
    }

    const client = getGeminiClient();
    const prompt = `Optimiza y mejora el siguiente texto para que sea narrado como un guión de audio/video profesional.
Manten un tono/estilo: "${mood || "profesional y cálido"}".
El tiempo de producción estimado para leerlo debe ser de aproximadamente ${duration || 10} segundos.
Intenta que la longitud del texto sea adecuada para durar esos segundos al hablar con velocidad normal (aprox. 2.5 palabras por segundo).
Genera SOLO el texto optimizado resultante, sin explicaciones ni introducciones.

Texto original:
"${text}"`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ enhancedText: response.text || text });
  } catch (error: any) {
    console.error("Error al mejorar texto con Gemini:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor al procesar el texto." });
  }
});

// Endpoint to synthesize audio using Gemini 3.1 Flash TTS model
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) {
      return res.status(400).json({ error: "El texto es obligatorio para la síntesis de voz." });
    }

    const client = getGeminiClient();
    console.log(` Sintonizando Gemini TTS: "${text.substring(0, 40)}..." con la voz ${voice || "Zephyr"}`);

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || "Zephyr"
            }
          }
        }
      }
    });

    let base64Audio = "";
    let mimeType = "audio/mp3";

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Audio = part.inlineData.data;
          if (part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          break;
        }
      }
    }

    if (!base64Audio) {
      throw new Error("El modelo de síntesis no entregó datos binarios de voz.");
    }

    res.json({ success: true, base64Audio, mimeType });
  } catch (error: any) {
    console.error("Error en endpoint /api/tts:", error);
    res.status(500).json({ error: error.message || "Error al procesar la síntesis de voz con la IA." });
  }
});

// Endpoint to generate a background image using Gemini (gemini-2.5-flash-image)
app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "El prompt para generar la imagen es obligatorio." });
    }

    const client = getGeminiClient();
    
    // Supported aspect ratios for gemini-2.5-flash-image in general image generation are "1:1", "3:4", "4:3", "9:16", and "16:9"
    const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    const selectedAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "16:9";

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `${prompt}, high-quality, continuous background visual, photorealistic style, aesthetic colors, high resolution`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: selectedAspectRatio as any,
        },
      },
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No se pudo obtener la imagen en formato base64 desde el modelo.");
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (error: any) {
    console.error("Error al generar imagen con Gemini:", error);
    
    // Check if the error is a quota/rate-limit or resource exhausted error
    const isQuotaError = 
      error.status === 429 || 
      (error.message && (
        error.message.includes("quota") || 
        error.message.includes("429") || 
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("limit")
      ));

    // Clean up prompt to form valid keywords for Unsplash public search
    const cleanPrompt = (req.body?.prompt || "scenic")
      .replace(/[^\w\s\-\u00C0-\u017F]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join(",");

    const fallbackUrl = `https://images.unsplash.com/featured/1200x675/?scenic,background,${encodeURIComponent(cleanPrompt || "aesthetic")}`;

    if (isQuotaError) {
      return res.status(200).json({ 
        imageUrl: fallbackUrl,
        isFallback: true,
        fallbackReason: "quota",
        message: "Límite de cuota IA de Gemini excedido (429). Para optimizar tu experiencia, hemos seleccionado un fondo decorativo HD de alta calidad basado en tu prompt."
      });
    }

    // For other general errors, return the fallback as well so the application is uninterrupted
    return res.status(200).json({
      imageUrl: fallbackUrl,
      isFallback: true,
      fallbackReason: "general",
      message: "El servidor de IA está muy ocupado en este momento. Se ha cargado un fondo alternativo decorativo de alta resolución."
    });
  }
});

// Endpoint to transcode recorded webm output using server-side ffmpeg for iOS & WhatsApp compatibility
app.post("/api/transcode", async (req, res) => {
  let inPath = "";
  let outPath = "";
  try {
    const { base64Data, type } = req.body; // type is "audio" or "video"
    if (!base64Data) {
      return res.status(400).json({ error: "No se proporcionaron datos de audio/video para transcodificar." });
    }

    const tempDir = os.tmpdir();
    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const inputExt = "webm";
    const outputExt = type === "video" ? "mp4" : "mp3";

    inPath = path.join(tempDir, `input_${uniqueId}.${inputExt}`);
    outPath = path.join(tempDir, `output_${uniqueId}.${outputExt}`);

    // Clean base64 and write to temp input file
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(cleanBase64, "base64");
    await fs.promises.writeFile(inPath, buffer);

    // Build lists of fallback commands to try sequentially in case of missing encoders or layout issues (e.g., missing audio tracks)
    const commandsToTry: string[] = [];

    if (type === "video") {
      commandsToTry.push(
        // Command 1: Force exact high-compatibility widescreen aspect scale (960x540) even pixels + AAC audio to suit standard WhatsApp guidelines
        `ffmpeg -y -i "${inPath}" -vf "scale=960:540,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -preset superfast "${outPath}"`,
        // Command 2: H264 video scale (960x540) with no audio track in case audio device didn't bind on capture
        `ffmpeg -y -i "${inPath}" -vf "scale=960:540,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart -preset superfast "${outPath}"`,
        // Command 3: Truncate iw/ih to divisible by 2 if the source has any metadata offsets
        `ffmpeg -y -i "${inPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -preset superfast "${outPath}"`,
        // Command 4: Older MPEG4 video + AAC audio (extremely flexible secondary encoder fallback)
        `ffmpeg -y -i "${inPath}" -vf "scale=960:540" -c:v mpeg4 -c:a aac -b:a 128k "${outPath}"`,
        // Command 5: Older MPEG4 video with no audio track
        `ffmpeg -y -i "${inPath}" -vf "scale=960:540" -c:v mpeg4 -an "${outPath}"`
      );
    } else {
      commandsToTry.push(
        // Command 1: High quality MP3 voice and background audio using standard mp3 lame
        `ffmpeg -y -i "${inPath}" -codec:a libmp3lame -b:a 128k "${outPath}"`,
        // Command 2: Standard MP3 format forcing ffmpeg auto-selection
        `ffmpeg -y -i "${inPath}" -f mp3 "${outPath}"`,
        // Command 3: Fallback standard AAC conversion
        `ffmpeg -y -i "${inPath}" -c:a aac -b:a 128k "${outPath}"`,
        // Command 4: Direct copy stream extraction fallback
        `ffmpeg -y -i "${inPath}" -c:a copy "${outPath}"`
      );
    }

    let success = false;
    let lastError: any = null;

    // Run cascade loop until a command succeeds
    for (let i = 0; i < commandsToTry.length; i++) {
      const currentCmd = commandsToTry[i];
      console.log(`[FFMPEG TRY ${i + 1}/${commandsToTry.length}]: ${currentCmd}`);
      try {
        await execPromise(currentCmd);
        // Verify output file exists and is not empty
        const stats = await fs.promises.stat(outPath);
        if (stats.size > 100) {
          success = true;
          console.log(`[FFMPEG SUCCESS] on try ${i + 1}! Output size is ${stats.size} bytes.`);
          break;
        }
      } catch (err: any) {
        console.warn(`[FFMPEG FAILED] try ${i + 1} output error:`, err.message || err);
        lastError = err;
        // Clean up output path partials if any to prevent corrupt reads
        try { await fs.promises.unlink(outPath); } catch (e) {}
      }
    }

    if (!success) {
      throw lastError || new Error("Todos los intentos de transcodificación FFmpeg fallaron.");
    }

    console.log(`Lectura del archivo de salida de ${type} procesado...`);
    const outBuffer = await fs.promises.readFile(outPath);
    const outputBase64 = outBuffer.toString("base64");

    // Clean up temp files safely
    try { await fs.promises.unlink(inPath); } catch (e) {}
    try { await fs.promises.unlink(outPath); } catch (e) {}

    return res.json({ 
      success: true, 
      base64Data: `data:${type === "video" ? "video/mp4" : "audio/mp3"};base64,${outputBase64}`,
      filename: `produccion_${type}_${Date.now()}.${outputExt}`,
      mimeType: type === "video" ? "video/mp4" : "audio/mp3"
    });
  } catch (error: any) {
    console.error("Error en endpoint /api/transcode:", error);
    if (inPath) { try { await fs.promises.unlink(inPath); } catch (e) {} }
    if (outPath) { try { await fs.promises.unlink(outPath); } catch (e) {} }
    res.status(500).json({ error: error.message || "Error interno del servidor al procesar el archivo." });
  }
});

// Setup Vite Dev server or Production static serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
