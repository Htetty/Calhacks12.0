import axios from "axios";
import { config } from "../config/index.js";

/**
 * Convert text to speech using Fish Audio API
 * @param {string} text - The text to convert to speech
 * @returns {Promise<Buffer>} - Audio file buffer
 */
export async function textToSpeech(text) {
  try {
    const requestBody = {
      text: text,
      format: "mp3",
      voice: config.FISH_VOICE_MODEL_ID,
    };

    const response = await axios.post(
      "https://api.fish.audio/v1/tts",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${config.FISH_API_KEY}`,
          "Content-Type": "application/json",
          model: config.FISH_VOICE_MODEL_ID,
        },
        responseType: "arraybuffer", // Get binary data
      }
    );

    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

/**
 * Convert text to speech and return as base64
 * @param {string} text - The text to convert to speech
 * @returns {Promise<string>} - Base64 encoded audio
 */
export async function textToSpeechBase64(text) {
  try {
    const buffer = await textToSpeech(text);
    return buffer.toString("base64");
  } catch (error) {
    throw error;
  }
}
