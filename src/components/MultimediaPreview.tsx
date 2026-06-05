/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from "react";
import { Play, Square, Loader, Image as ImageIcon, VolumeX, Volume2, Sparkles, Download, Captions } from "lucide-react";
import { GeneratorConfig } from "../types";

interface MultimediaPreviewProps {
  text: string;
  imageUrl: string;
  videoUrl?: string;
  isGenerating: boolean;
  isPlaying: boolean;
  progress: number; // 0 to 100 for generation
  onPlay: () => void;
  onStop: () => void;
  config: GeneratorConfig;
  analyserNode: AnalyserNode | null;
  recordingStream: MediaStream | null;
  onSetMouthPosition?: (x: number, y: number) => void;
}

export default function MultimediaPreview({
  text,
  imageUrl,
  videoUrl = "",
  isGenerating,
  isPlaying,
  progress,
  onPlay,
  onStop,
  config,
  analyserNode,
  recordingStream,
  onSetMouthPosition,
}: MultimediaPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const videoObjRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Local dimensions to fit container
  const [dimensions, setDimensions] = useState({ width: 640, height: 360 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Subtitle timing control
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [wordsList, setWordsList] = useState<string[]>([]);

  // Split text into words list when text changes
  useEffect(() => {
    const cleanText = text.trim().replace(/[\r\n]+/g, " ");
    const words = cleanText ? cleanText.split(/\s+/) : [];
    setWordsList(words);
    setCurrentWordIndex(-1);
  }, [text]);

  // Keep track of words spoken (simulate matching the current time of speech)
  useEffect(() => {
    if (!isPlaying) {
      setCurrentWordIndex(-1);
      return;
    }

    // Estimate based on config.speed
    // Average speech rate is about 2.2 to 2.8 words per second at rate 1.0
    const BaseWps = 2.4;
    const wordsPerSecond = BaseWps * config.speed;
    const intervalMs = 1000 / wordsPerSecond;

    let index = 0;
    setCurrentWordIndex(0);

    const timer = setInterval(() => {
      index++;
      if (index < wordsList.length) {
        setCurrentWordIndex(index);
      } else {
        clearInterval(timer);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, wordsList, config.speed]);

  // Handle image loading
  useEffect(() => {
    if (!imageUrl) {
      imageObjRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; // prevent canvas tainting if possible
    img.referrerPolicy = "no-referrer";
    img.src = imageUrl;
    img.onload = () => {
      imageObjRef.current = img;
    };
  }, [imageUrl]);

  // Handle video loading
  useEffect(() => {
    if (!videoUrl) {
      if (videoObjRef.current) {
        videoObjRef.current.pause();
        videoObjRef.current = null;
      }
      return;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.preload = "auto";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    videoObjRef.current = video;

    if (isPlaying) {
      video.play().catch(() => {});
    }
  }, [videoUrl, isPlaying]);

  // Sync video play/pause with isPlaying
  useEffect(() => {
    const video = videoObjRef.current;
    if (!video) return;

    if (isPlaying) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isPlaying]);

  // Dynamic container resizing for canvas aspect ratio
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      // Fixed 16:9 ratio
      const calculatedHeight = Math.floor(containerWidth * (9 / 16));
      setDimensions({ width: containerWidth, height: calculatedHeight });
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    resizeObserver.observe(containerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime = Date.now();
    const fData = new Uint8Array(analyserNode ? analyserNode.frequencyBinCount : 128);

    const render = () => {
      // Force internal processing and capture resolution to exactly 960x540 for high performance and total compatibility with universal H.264 profiles (no odd-dimension failures)
      const w = 960;
      const h = 540;
      
      // Ensure canvas inner resolution matches DOM
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const elapsed = (Date.now() - startTime) / 1000; // in seconds

      // Shared dimensions for the background image render to share with lip-sync warping
      let destW = w;
      let destH = h;
      let destX = 0;
      let destY = 0;

      // 1. Render Background Video or Image
      if (videoUrl && videoObjRef.current) {
        let zoom = 1.0;
        let dx = 0;
        let dy = 0;

        if (config.visualEffect === "pan-zoom") {
          zoom = 1.0 + Math.sin(elapsed * 0.05) * 0.04;
          dx = Math.sin(elapsed * 0.1) * (w * 0.01);
          dy = Math.cos(elapsed * 0.12) * (h * 0.01);
        } else if (config.visualEffect === "ripple" && isPlaying) {
          zoom = 1.01 + Math.abs(Math.sin(elapsed * 4)) * 0.01;
        }

        destW = w * zoom;
        destH = h * zoom;
        destX = (w - destW) / 2 + dx;
        destY = (h - destH) / 2 + dy;

        try {
          const video = videoObjRef.current;
          if (video.readyState >= 2) {
            ctx.drawImage(video, destX, destY, destW, destH);
          } else {
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "rgba(163, 163, 163, 0.4)";
            ctx.font = "italic 11px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Inicializando video HD...", w / 2, h / 2);
          }
        } catch (e) {
          ctx.fillStyle = "#171717";
          ctx.fillRect(0, 0, w, h);
        }
      } else if (imageObjRef.current) {
        let zoom = 1.0;
        let dx = 0;
        let dy = 0;

        if (config.visualEffect === "pan-zoom") {
          // Subtle circular pan and slow zoom
          zoom = 1.0 + Math.sin(elapsed * 0.05) * 0.08;
          dx = Math.sin(elapsed * 0.1) * (w * 0.02);
          dy = Math.cos(elapsed * 0.12) * (h * 0.02);
        } else if (config.visualEffect === "ripple" && isPlaying) {
          // Oscillating visual bounce
          zoom = 1.02 + Math.abs(Math.sin(elapsed * 4)) * 0.015;
        }

        destW = w * zoom;
        destH = h * zoom;
        destX = (w - destW) / 2 + dx;
        destY = (h - destH) / 2 + dy;

        try {
          ctx.drawImage(imageObjRef.current, destX, destY, destW, destH);
        } catch (e) {
          // Fallback if image has canvas security restrictions or failed loading
          ctx.fillStyle = "#171717";
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        // Aesthetic Gradient if no image
        const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, w/1.2);
        grad.addColorStop(0, "#1c1917");
        grad.addColorStop(1, "#0c0a09");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Simple placeholder graphic
        ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < w; j += 30) {
          ctx.moveTo(j, 0);
          ctx.lineTo(j, h);
        }
        for (let k = 0; k < h; k += 30) {
          ctx.moveTo(0, k);
          ctx.lineTo(w, k);
        }
        ctx.stroke();

        ctx.fillStyle = "rgba(115, 115, 115, 0.4)";
        ctx.font = "italic 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sube un fondo (Imagen/Video) o genéralo con IA", w / 2, h / 2 - 10);
      }

      // 2. Visual Effects Additions (e.g. Vignette shadow)
      const vignette = ctx.createRadialGradient(w/2, h/2, h/2.5, w/2, h/2, w/1.3);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // 2.1 Procedural Lip Sync Simulation on Photograph or Video background
      if (config.lipSyncEnabled && (imageObjRef.current || (videoUrl && videoObjRef.current && videoObjRef.current.readyState >= 2))) {
        let avgAmp = 0;
        if (isPlaying && analyserNode) {
          analyserNode.getByteFrequencyData(fData);
          let sum = 0;
          for (let i = 0; i < fData.length; i++) {
            sum += fData[i];
          }
          avgAmp = sum / fData.length;
        }

        let openFactor = 0;
        if (isPlaying) {
          if (analyserNode) {
            openFactor = Math.min(avgAmp / 45, 1.0);
          } else {
            openFactor = 0.2 + Math.abs(Math.sin(elapsed * 15)) * 0.8;
          }
        }

        const mouthX = config.mouthX !== undefined ? config.mouthX : 0.5;
        const mouthY = config.mouthY !== undefined ? config.mouthY : 0.65;
        const cx = mouthX * w;
        const cy = mouthY * h;

        // Perform procedural photorealistic mouth expansion only when talking
        const img = imageObjRef.current || videoObjRef.current;
        if (openFactor > 0.01 && img) {
          // Width and height of mouth box relative to image/video natural size
          let naturalWidth = 960;
          let naturalHeight = 540;
          if (img instanceof HTMLImageElement) {
            naturalWidth = img.naturalWidth;
            naturalHeight = img.naturalHeight;
          } else if (img instanceof HTMLVideoElement) {
            naturalWidth = img.videoWidth || 960;
            naturalHeight = img.videoHeight || 540;
          }

          const srcMW = naturalWidth * 0.12;
          const srcMH = naturalHeight * 0.06;
          const srcMouthX = mouthX * naturalWidth;
          const srcMouthY = mouthY * naturalHeight;

          // Width and height of mouth on the canvas
          const dMW = destW * 0.12;
          const dMH = destH * 0.06;
          
          // Absolute center of the mouth on the canvas (taking dynamic pan/zoom into account!)
          const dCX = destX + mouthX * destW;
          const dCY = destY + mouthY * destH;

          // Maximum vertical split shift in pixels on the canvas based on mouth height
          const maxShift = dMH * 0.28; 
          const shiftY = maxShift * openFactor;

          // 1. Draw a dark oral cavity under shifted lips (inside mouth)
          ctx.fillStyle = "#1e0404"; // Rich organic dark cavity color
          ctx.beginPath();
          ctx.ellipse(dCX, dCY, dMW * 0.38, dMH * 0.38 * openFactor, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Wrap and draw Upper Lip half from original image/video frame
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(dCX, dCY - dMH * 0.21 - shiftY, dMW * 0.45, dMH * 0.24, 0, 0, Math.PI * 2);
          ctx.clip();
          try {
            ctx.drawImage(
              img,
              srcMouthX - srcMW / 2,
              srcMouthY - srcMH / 2,
              srcMW,
              srcMH / 2,
              dCX - dMW / 2,
              dCY - dMH / 2 - shiftY,
              dMW,
              dMH / 2
            );
          } catch (e) {}
          ctx.restore();

          // 3. Wrap and draw Lower Lip half from original image/video frame
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(dCX, dCY + dMH * 0.21 + shiftY, dMW * 0.45, dMH * 0.24, 0, 0, Math.PI * 2);
          ctx.clip();
          try {
            ctx.drawImage(
              img,
              srcMouthX - srcMW / 2,
              srcMouthY,
              srcMW,
              srcMH / 2,
              dCX - dMW / 2,
              dCY + shiftY,
              dMW,
              dMH / 2
            );
          } catch (e) {}
          ctx.restore();
        }

        // Draw crosshair helper when paused
        if (!isPlaying) {
          ctx.save();
          ctx.strokeStyle = "rgba(16, 185, 129, 0.85)"; // Use emerald theme accent color
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.font = "bold 11px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("POSICIÓN DE LABIOS (HAZ CLICK EN LA REPRODUCCIÓN PARA AJUSTAR)", cx, cy + 24);
          ctx.restore();
        }
      }

      // 3. Audio Spectrogram Waveform Overlay
      if (config.visualEffect !== "static") {
        let isQuiet = true;
        if (analyserNode && isPlaying) {
          analyserNode.getByteFrequencyData(fData);
          isQuiet = false;
        }

        // Draw dynamic sound analyzer spectrum lines across bottom or custom shape
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.85)"; // glowing emerald
        ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const barCount = 48;
        const barWidth = (w / barCount);

        for (let i = 0; i < barCount; i++) {
          const ratio = i / barCount;
          // Retrieve audio frequency height
          let waveHeight = 0;
          if (!isQuiet && analyserNode) {
            // grab log spaced values from fData for nice acoustic spacing
            const bin = Math.floor(ratio * fData.length * 0.65);
            waveHeight = (fData[bin] / 255) * (h * 0.35);
          } else if (isPlaying) {
            // Simulated speech movement
            waveHeight = (Math.sin(elapsed * 12 + i * 0.4) * 0.3 + 0.3) * (h * 0.12);
          } else {
            // Gentle ambient waveform
            waveHeight = (Math.sin(elapsed * 2 + i * 0.18) * 0.5 + 0.5) * 8;
          }

          // Render bars symmetry in the center or floor aligned
          const x = i * barWidth + barWidth / 2;
          const yCenter = h - 45;

          // Draw neon spectrum bar
          ctx.moveTo(x, yCenter - waveHeight / 2);
          ctx.lineTo(x, yCenter + waveHeight / 2);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow
      }

      // 4. Glowing Studio Logo marker in corners for UI fidelity
      ctx.fillStyle = "rgba(16, 185, 129, 0.65)";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("● GENERADOR AUDIO/VIDEO PRO", 24, 32);
      
      ctx.fillStyle = "rgba(163, 163, 163, 0.6)";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      const totalSeconds = config.duration;
      ctx.fillText(`TIMELINE: 0:00 / 0:${totalSeconds < 10 ? "0" + totalSeconds : totalSeconds}`, w - 24, 32);

      // 5. Draw Animated Synced captions (Suptítulos)
      if (isPlaying && wordsList.length > 0 && currentWordIndex >= 0) {
        const textToDisplay = wordsList.slice(Math.max(0, currentWordIndex - 3), currentWordIndex + 5).join(" ");
        
        ctx.font = "600 22px Inter, sans-serif";
        ctx.textAlign = "center";
        
        // Measure coordinate location
        let subtitleY = h - 80;
        if (config.subtitlePosition === "top") subtitleY = 82;
        if (config.subtitlePosition === "center") subtitleY = h / 2;

        // Draw shadow/box behind captions
        const textWidth = ctx.measureText(textToDisplay).width;
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.roundRect(w / 2 - textWidth / 2 - 20, subtitleY - 28, textWidth + 40, 40, [8]);
        ctx.fill();

        ctx.fillStyle = config.subtitleColor || "#ffffff";
        ctx.fillText(textToDisplay, w / 2, subtitleY);
      }

      // Red loop
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, imageUrl, isPlaying, config, analyserNode, wordsList, currentWordIndex]);

  return (
    <div className="flex flex-col bg-neutral-950 border border-neutral-900 rounded-xl overflow-hidden shadow-2xl" id="multimedia-preview-container">
      {/* Absolute Preview Banner */}
      <div className="bg-neutral-900 px-4 py-2.5 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Captions className="h-4 w-4 text-emerald-400" />
          <span className="font-mono text-xs text-neutral-300 font-medium uppercase tracking-wider">
            Pantalla de Visualización en Tiempo Real
          </span>
        </div>
        {isPlaying && (
          <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[10px] font-mono font-semibold animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            PRODUCCIÓN AL AIRE / LIVE MONITOR
          </div>
        )}
      </div>

      {/* Main Canvas Viewport Area */}
      <div ref={containerRef} className="relative w-full bg-neutral-900 flex items-center justify-center p-0.5 overflow-hidden">
        <canvas
          ref={canvasRef}
          id="production-canvas"
          onClick={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            if (onSetMouthPosition) {
              onSetMouthPosition(x, y);
            }
          }}
          className={`bg-neutral-950 block max-w-full rounded-md shadow-inner transition-all duration-300 ${
            !videoUrl && config.lipSyncEnabled && !isPlaying ? "cursor-crosshair hover:brightness-110" : ""
          }`}
          style={{ width: "100%", height: "auto" }}
        />

        {/* Big visual generate overlay during processing */}
        {isGenerating && (
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="relative mb-4 flex items-center justify-center">
              <Loader className="h-12 w-12 text-emerald-400 animate-spin" />
              <Sparkles className="h-5 w-5 text-yellow-300 absolute" />
            </div>
            <h4 className="font-sans font-bold text-neutral-100 text-sm mb-1.5">
              Procesando y Mezclando Ondas Multimedia...
            </h4>
            <p className="text-xs text-neutral-400 max-w-sm mb-4 font-sans leading-relaxed">
              Combinando la pista de voz procedural, el sub-bajo y los sintetizadores de fondo seleccionados en un archivo unificado.
            </p>
            <div className="w-56 bg-neutral-800 h-2 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 mt-2 font-semibold">
              {progress}% Completado
            </span>
          </div>
        )}
      </div>

      {/* Playback Controls & Utility Bar */}
      <div className="bg-neutral-900 border-t border-neutral-800 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {isPlaying ? (
            <button
              id="btn-stop-preview"
              onClick={onStop}
              className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-sans text-xs font-semibold py-2 px-4 rounded-lg border border-transparent shadow hover:scale-105 active:scale-95 transition-all text-center cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Detener Preescucha
            </button>
          ) : (
            <button
              id="btn-play-preview"
              onClick={onPlay}
              disabled={isGenerating || !text.trim()}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:scale-100 text-neutral-950 font-sans text-xs font-bold py-2 px-5.5 rounded-lg border border-transparent shadow hover:scale-105 active:scale-95 transition-all text-center cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Preescucha de Producción
            </button>
          )}

          <div className="flex items-center gap-1.5 text-neutral-500 font-mono text-[11px] border-l border-neutral-800 pl-3">
            {config.backgroundNoise !== "none" ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-neutral-300 lowercase italic">
                  + synth {config.backgroundNoise} ({Math.round(config.backgroundNoiseVolume * 100)}%)
                </span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-neutral-500" />
                <span>no ambient background</span>
              </>
            )}
          </div>
        </div>

        {/* Visual Effect Mode Pill Controls */}
        <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800 self-start sm:self-auto">
          <span className="text-[10px] text-neutral-500 font-mono tracking-wider uppercase">Visual:</span>
          <span className="text-[11px] text-emerald-400 font-sans font-medium capitalize">
            {config.visualEffect === "audio-spectrogram"
              ? "Espectrograma de Ondas"
              : config.visualEffect === "pan-zoom"
              ? "Efecto Ken Burns"
              : config.visualEffect === "ripple"
              ? "Vibración de Ritmo"
              : "Clásica Estática"}
          </span>
        </div>
      </div>
    </div>
  );
}
