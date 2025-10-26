import { textToSpeech } from "../services/tts.js";

/**
 * Convert text to speech
 * POST /api/tts
 * Body: { text: "..." }
 */
export const generateTTS = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Text is required",
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Text cannot be empty",
      });
    }

    const audioBuffer = await textToSpeech(text);

    // Set proper headers for audio response
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-cache");

    return res.send(audioBuffer);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to generate speech: " + (error.message || "Unknown error"),
    });
  }
};
