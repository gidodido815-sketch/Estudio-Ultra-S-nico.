/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Mic, Radio, BookOpen, Volume2, Sparkles, Brain } from "lucide-react";
import { GeneratorConfig, BackgroundNoiseType } from "../types";

export interface Preset {
  name: string;
  description: string;
  icon: any;
  config: Partial<GeneratorConfig>;
}

const PRESETS: Preset[] = [
  {
    name: "Podcast Nocturno",
    description: "Voz profunda y pausada con un zumbido de drone espacial para misterio o charlas reflexivas.",
    icon: Mic,
    config: {
      speed: 0.9,
      pitch: 0.85,
      subBassSustained: true,
      subBassIntensity: 0.8,
      backgroundNoise: "drone_espacial",
      backgroundNoiseVolume: 0.15,
      voiceVolume: 0.9,
      visualEffect: "audio-spectrogram",
    },
  },
  {
    name: "Locución de Radio AD",
    description: "Voz rápida, clara y con un tono ligeramente agudo y enérgico, libre de ruidos molestos.",
    icon: Radio,
    config: {
      speed: 1.15,
      pitch: 1.05,
      subBassSustained: true,
      subBassIntensity: 0.4,
      backgroundNoise: "none",
      backgroundNoiseVolume: 0,
      voiceVolume: 1.0,
      visualEffect: "pan-zoom",
    },
  },
  {
    name: "Audiolibro en la Lluvia",
    description: "Relato pacífico y natural con sonidos de lluvia relajante en segundo plano.",
    icon: BookOpen,
    config: {
      speed: 0.95,
      pitch: 1.0,
      subBassSustained: false,
      subBassIntensity: 0,
      backgroundNoise: "rain",
      backgroundNoiseVolume: 0.25,
      voiceVolume: 0.85,
      visualEffect: "pan-zoom",
    },
  },
  {
    name: "Ciber-Transmisión Robot",
    description: "Tono metálico con zumbido de oficina o frecuencias de fondo tipo cyber futurista.",
    icon: Brain,
    config: {
      speed: 1.0,
      pitch: 0.65,
      subBassSustained: true,
      subBassIntensity: 0.9,
      backgroundNoise: "oficina",
      backgroundNoiseVolume: 0.18,
      voiceVolume: 1.0,
      visualEffect: "ripple",
    },
  },
  {
    name: "Meditación Profunda",
    description: "Ritmo sumamente lento con zumbidos de naturaleza y realce de bajos para vibración zen.",
    icon: Sparkles,
    config: {
      speed: 0.8,
      pitch: 0.9,
      subBassSustained: true,
      subBassIntensity: 0.95,
      backgroundNoise: "naturaleza",
      backgroundNoiseVolume: 0.35,
      voiceVolume: 0.75,
      visualEffect: "ripple",
    },
  },
];

interface PresetsSelectorProps {
  onSelectPreset: (presetConfig: Partial<GeneratorConfig>) => void;
  currentConfig: GeneratorConfig;
}

export default function PresetsSelector({ onSelectPreset, currentConfig }: PresetsSelectorProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5" id="presets-selector-container">
      <div className="flex items-center gap-2 mb-4">
        <Volume2 className="h-5 w-5 text-emerald-400" />
        <h3 className="font-sans font-semibold text-neutral-100 text-sm tracking-wide uppercase">
          Pre-ajustes Rápidos (Fisicalidad del Sonido)
        </h3>
      </div>
      <p className="text-xs text-neutral-400 mb-4 font-sans leading-relaxed">
        Elige un estilo acústico predefinido para configurar instantáneamente los osciladores, ecualización y ruidos ambientales.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3" id="presets-grid">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.name}
              id={`preset-btn-${p.name.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => onSelectPreset(p.config)}
              type="button"
              className="flex flex-col items-start text-left p-3.5 rounded-lg border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-850 hover:border-emerald-500/40 transition-all duration-200 cursor-pointer group"
            >
              <div className="p-1.5 bg-neutral-900 rounded border border-neutral-800 text-neutral-400 group-hover:text-emerald-400 group-hover:border-emerald-500/20 transition-colors mb-2">
                <Icon className="h-4 w-4" />
              </div>
              <h5 className="font-sans font-medium text-neutral-200 text-xs mb-1 group-hover:text-neutral-50">
                {p.name}
              </h5>
              <p className="font-sans text-[10px] text-neutral-500 leading-normal line-clamp-2 select-none">
                {p.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
