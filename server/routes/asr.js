import { speechToText, speechToTextWithDetails } from "../services/asr.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
});

/**
 * Convert speech to text
 * POST /api/asr
 * Content-Type: multipart/form-data
 * Body: { audio: File }
 */
export const transcribe = async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        ok: false,
        error: "Audio file is required",
      });
    }
    const language = req.body.language || null;

    const audioBuffer = Buffer.from(audioFile.buffer);
    const text = await speechToText(audioBuffer, language);

    return res.json({
      ok: true,
      text,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error:
        "Failed to transcribe audio: " + (error.message || "Unknown error"),
    });
  }
};

/**
 * Transcribe speech with detailed segments
 * POST /api/asr/detailed
 * Content-Type: multipart/form-data
 * Body: { audio: File, language?: string }
 */
export const transcribeDetailed = async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        ok: false,
        error: "Audio file is required",
      });
    }

    const language = req.body.language || null;

    const audioBuffer = Buffer.from(audioFile.buffer);
    const result = await speechToTextWithDetails(audioBuffer, language);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error:
        "Failed to transcribe audio: " + (error.message || "Unknown error"),
    });
  }
};

export { upload };
