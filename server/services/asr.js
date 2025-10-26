import axios from "axios";
import FormData from "form-data";
import { config } from "../config/index.js";

/**
 * Convert speech to text using Fish Audio API (ASR - Automatic Speech Recognition)
 * @param {Buffer} audioData - Audio file buffer to transcribe
 * @param {string} language - Optional language code (e.g., "en", "zh")
 * @returns {Promise<string>} - Transcribed text
 */
export async function speechToText(audioData, language = null) {
  try {
    const formData = new FormData();

    formData.append("audio", audioData, {
      filename: "recording.webm",
      contentType: "audio/webm",
    });

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${config.FISH_API_KEY}`,
    };

    if (language) {
      headers["language"] = language;
    }

    const response = await axios.post(
      "https://api.fish.audio/v1/asr",
      formData,
      {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return response.data.text || "";
  } catch (error) {
    throw error;
  }
}

/**
 * Transcribe audio and return full response with segments
 * @param {Buffer} audioData - Audio file buffer to transcribe
 * @param {string} language - Optional language code
 * @returns {Promise<Object>} - Full response with text, duration, and segments
 */
export async function speechToTextWithDetails(audioData, language = null) {
  try {
    const formData = new FormData();

    formData.append("audio", audioData, {
      filename: "recording.webm",
      contentType: "audio/webm",
    });

    const headers = {
      ...formData.getHeaders(),
      Authorization: `Bearer ${config.FISH_API_KEY}`,
    };

    if (language) {
      headers["language"] = language;
    }

    const response = await axios.post(
      "https://api.fish.audio/v1/asr",
      formData,
      {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return {
      text: response.data.text,
      duration: response.data.duration,
      segments: response.data.segments || [],
    };
  } catch (error) {
    throw error;
  }
}
