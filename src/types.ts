/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BackgroundNoiseType =
  | "none"
  | "rain"
  | "cafeteria"
  | "oficina"
  | "naturaleza"
  | "drone_espacial"
  | "ruido_blanco";

export interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female" | "robot" | "other";
  lang: string;
  description: string;
  pitchMultiplier: number; // default pitch multiplier
  rateMultiplier: number;  // default rate multiplier
  subBassFactor: number;   // default sub bass enhancement level
}

export interface GeneratorConfig {
  voiceId: string;
  speed: number;              // 0.5 to 2.0
  pitch: number;              // 0.5 to 2.0
  subBassSustained: boolean;  // whether to inject sustained 50Hz deep resonance synchronized with audio
  subBassIntensity: number;   // sub-bass oscillator gain multiplier (0 to 1)
  backgroundNoise: BackgroundNoiseType;
  backgroundNoiseVolume: number; // 0 to 1
  voiceVolume: number;        // 0 to 1
  duration: number;           // estimated production duration limit in seconds (5, 10, 15, 30, etc.)
  subtitleColor: string;      // styling for video subtitles
  subtitlePosition: "bottom" | "top" | "center";
  visualEffect: "pan-zoom" | "ripple" | "audio-spectrogram" | "static";
  lipSyncEnabled?: boolean;    // enable lip movement on photograph
  mouthX?: number;            // horizontal position of animated lips (0-1)
  mouthY?: number;            // vertical position of animated lips (0-1)
}

export interface GenerationHistoryItem {
  id: string;
  type: "audio" | "video";
  timestamp: string;
  text: string;
  imageUrl?: string;
  duration: number;
  config: GeneratorConfig;
  mediaUrl: string; // Blob URL of the generated file
}
