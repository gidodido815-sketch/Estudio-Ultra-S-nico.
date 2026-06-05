/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import {
  Play,
  Square,
  Download,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Sliders,
  Settings,
  History,
  Clock,
  RotateCcw,
  Camera,
  Check,
  AlertCircle,
  Wand2,
  ChevronRight,
  User,
  Music,
  Video,
  FileText,
  HelpCircle,
  Loader2,
  FolderSync,
  Layers,
  Trash,
  Image,
} from "lucide-react";
import {
  GeneratorConfig,
  VoiceOption,
  BackgroundNoiseType,
  GenerationHistoryItem,
} from "./types";
import { buildAudioSystem, addSubBassSynthesizer, CustomAudioGraph } from "./utils/audioEngine";
import PresetsSelector from "./components/PresetsSelector";
import MultimediaPreview from "./components/MultimediaPreview";

// Default voices list that we display alongside browser native ones
const BASE_NATIVE_VOICES = [
  { id: "es-local-f", name: "Helena (Femenina Local)", gender: "female", lang: "es-ES" },
  { id: "es-local-m", name: "Julio (Masculino Local)", gender: "male", lang: "es-ES" },
  { id: "synth-retro", name: "Sintetizador Formante 2080 (Cyber-Voz)", gender: "robot", lang: "es-ES" },
];

export default function App() {
  // Config state
  const [config, setConfig] = useState<GeneratorConfig>({
    voiceId: "gemini-zephyr",
    speed: 1.0,
    pitch: 1.0,
    subBassSustained: true,
    subBassIntensity: 0.6,
    backgroundNoise: "drone_espacial",
    backgroundNoiseVolume: 0.2,
    voiceVolume: 0.85,
    duration: 15,
    subtitleColor: "#ffffff",
    subtitlePosition: "bottom",
    visualEffect: "audio-spectrogram",
    lipSyncEnabled: true,
    mouthX: 0.5,
    mouthY: 0.68,
  });

  // Text Script states
  const [scriptText, setScriptText] = useState(
    "La innovación digital nos conecta con el infinito. Bienvenidos a esta nueva experiencia sonora."
  );
  const [aiPrompt, setAiPrompt] = useState("A beautiful modern cyberpunk recording studio, neon lights, highly detailed, realistic, dark ambient");
  const [moodStyle, setMoodStyle] = useState("profesional y cálido");

  // Dynamic galleries (up to 5 each)
  const [customPhotos, setCustomPhotos] = useState<Array<{ id: string; name: string; url: string; file: File | null }>>([
    {
      id: "photo_p1",
      name: "Locutora Femenina de Estudio",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
      file: null
    },
    {
      id: "photo_p2",
      name: "Modelo Masculino Expresivo",
      url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&auto=format&fit=crop",
      file: null
    },
    {
      id: "photo_p3",
      name: "Fondo Abstracto Inicial",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
      file: null
    }
  ]);

  const [customVideos, setCustomVideos] = useState<Array<{ id: string; name: string; url: string; file: File | null }>>([
    {
      id: "video_pv1",
      name: "Fondo Láser Neón Loop",
      url: "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41851-large.mp4",
      file: null
    },
    {
      id: "video_pv2",
      name: "Ondas Cyber Retro Loop",
      url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-blue-and-pink-stripes-31952-large.mp4",
      file: null
    }
  ]);

  // Media states
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Native voices from WebSpeechAPI
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceObj, setSelectedVoiceObj] = useState<SpeechSynthesisVoice | null>(null);

  // App running states
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isEnhancingText, setIsEnhancingText] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Batch Queue states
  const [batchState, setBatchState] = useState({
    isActive: false,
    currentIndex: 0,
    progress: 0,
    message: "",
    totalItems: 0,
  });
  
  // Audio playback graph state
  const audioGraphRef = useRef<CustomAudioGraph | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const playTimerRef = useRef<any | null>(null);

  // History state
  const [historyList, setHistoryList] = useState<GenerationHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Populate browser voices
  useEffect(() => {
    const updateVoicesList = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const list = window.speechSynthesis.getVoices();
        // filter or sort in spanish order
        const sorted = [...list].sort((a, b) => {
          const aEs = a.lang.toLowerCase().includes("es");
          const bEs = b.lang.toLowerCase().includes("es");
          if (aEs && !bEs) return -1;
          if (!aEs && bEs) return 1;
          return a.name.localeCompare(b.name);
        });
        setBrowserVoices(sorted);
        
        // Auto pick default
        if (sorted.length > 0 && !selectedVoiceObj) {
          const defaultEs = sorted.find(v => v.lang.toLowerCase().includes("es"));
          setSelectedVoiceObj(defaultEs || sorted[0]);
        }
      }
    };

    updateVoicesList();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoicesList;
    }
  }, [selectedVoiceObj]);

  // Load sample image on initial mount
  useEffect(() => {
    // Elegant background initial mockup
    setImageUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop");
  }, []);

  // Set alert messages with auto-expiry
  const showAlert = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMessage(message);
      setErrorMessage("");
      setTimeout(() => setSuccessMessage(""), 5000);
    } else {
      setErrorMessage(message);
      setSuccessMessage("");
      setTimeout(() => setErrorMessage(""), 6000);
    }
  };

  // Helper: Trigger a procedural vox vocal sound to animate sub-bass and visual spectrogram
  const triggerProceduralVoicePulse = (duration = 0.25) => {
    if (!audioGraphRef.current) return;
    const { ctx, voiceGain } = audioGraphRef.current;
    const now = ctx.currentTime;

    // Vocal synth Carrier
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    // base fundamental voice matches config pitch setting
    const freq = 110 * config.pitch; 
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 1.51, now); 

    // Dynamic bandpass filters simulator vocal formant chords (human speaking effect)
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(750, now);
    filter.Q.setValueAtTime(4.0, now);

    // sweep standard vowel sound range
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(config.voiceVolume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(voiceGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  };

  // Synthesizes script and returns the raw Uint8Array payload to allow decoding across independent AudioContexts
  const synthesizeScriptToUint8Array = async (text: string, voiceId: string): Promise<Uint8Array> => {
    let targetVoice = "Zephyr";
    if (voiceId === "gemini-kore") targetVoice = "Kore";
    else if (voiceId === "gemini-zephyr") targetVoice = "Zephyr";
    else if (voiceId === "gemini-puck") targetVoice = "Puck";
    else if (voiceId === "gemini-charon") targetVoice = "Charon";
    else if (voiceId === "gemini-fenrir") targetVoice = "Fenrir";
    else {
      const vName = voiceId.toLowerCase();
      if (vName.includes("female") || vName.includes("femenina") || vName.includes("helena")) {
        targetVoice = "Kore";
      } else {
        targetVoice = "Puck";
      }
    }

    const ttsRes = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: targetVoice })
    });

    if (!ttsRes.ok) {
      const errData = await ttsRes.json().catch(() => ({}));
      throw new Error(errData.error || `Síncopa de red: estatus ${ttsRes.status}`);
    }

    const resJson = await ttsRes.json();
    if (!resJson.success || !resJson.base64Audio) {
      throw new Error("Respuesta binaria de audio vacía.");
    }

    const binaryStr = window.atob(resJson.base64Audio);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  };

  // High-fidelity voice synthesis from Gemini 3.1 Flash TTS Model
  const synthesizeScriptToAudioBuffer = async (text: string, voiceId: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const bytes = await synthesizeScriptToUint8Array(text, voiceId);
    return await ctx.decodeAudioData(bytes.buffer);
  };

  // Drag and Drop local image or video upload
  const handleFileChange = (file: File) => {
    if (file.type.startsWith("image/")) {
      if (customPhotos.length >= 5) {
        showAlert("error", "Ya cuentas con 5 fotos añadidas en tu galería. Por favor elimina alguna para continuar.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const matchedResult = e.target.result as string;
          const newPhoto = {
            id: `custom_photo_${Date.now()}`,
            name: file.name,
            url: matchedResult,
            file: file
          };
          setCustomPhotos(prev => [...prev, newPhoto]);
          setImageFile(file);
          setVideoFile(null);
          setVideoUrl("");
          setImageUrl(matchedResult);
          showAlert("success", `Foto "${file.name}" cargada con éxito y agregada a tu colección.`);
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      if (customVideos.length >= 5) {
        showAlert("error", "Ya cuentas con 5 videos añadidos en tu galería. Por favor elimina alguno para continuar.");
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const newVideo = {
        id: `custom_video_${Date.now()}`,
        name: file.name,
        url: objectUrl,
        file: file
      };
      setCustomVideos(prev => [...prev, newVideo]);
      setVideoFile(file);
      setImageFile(null);
      setImageUrl("");
      setVideoUrl(objectUrl);
      showAlert("success", `Video "${file.name}" cargado con éxito y agregado a tu colección.`);
    } else {
      showAlert("error", "Por favor selecciona un archivo de imagen (PNG, JPG, WEBP) o video (MP4, WEBM) válido.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // API Call: Optimize text script using Gemini
  const handleEnhanceScript = async () => {
    if (!scriptText.trim()) {
      showAlert("error", "Por favor ingresa un texto primero para poder mejorarlo.");
      return;
    }

    setIsEnhancingText(true);
    try {
      const response = await fetch("/api/gemini/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          mood: moodStyle,
          duration: config.duration,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo conectar con el servicio de Inteligencia Artificial.");
      }

      const data = await response.json();
      if (data.enhancedText) {
        setScriptText(data.enhancedText);
        showAlert("success", "Script optimizado y ajustado con éxito por Gemini.");
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      showAlert("error", e.message || "Error al conectar con Gemini API para la optimización.");
    } finally {
      setIsEnhancingText(false);
    }
  };

  // API Call: Generate premium background image using Gemini (gemini-2.5-flash-image)
  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) {
      showAlert("error", "Por favor escribe un prompt para la generación visual.");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const response = await fetch("/api/gemini/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          aspectRatio: "16:9",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "No se pudo generar la imagen mediante IA.");
      }

      const data = await response.json();
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        if (data.isFallback) {
          showAlert("success", data.message || "Se ha cargado un fondo alternativo decorativo en HD.");
        } else {
          showAlert("success", "Imagen espectacular generada y cargada por Gemini-2.5-flash-image.");
        }
      } else {
        throw new Error("No se devolvió ninguna dirección de imagen válida.");
      }
    } catch (e: any) {
      console.error("Client fallback image selection triggering due to:", e);
      
      // Client-side failover using Unsplash public featured search engine
      const cleanPrompt = aiPrompt
        .replace(/[^\w\s\-\u00C0-\u017F]/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join(",");
      const fallbackUrl = `https://images.unsplash.com/featured/1200x675/?scenic,background,${encodeURIComponent(cleanPrompt || "aesthetic")}`;
      
      setImageUrl(fallbackUrl);
      showAlert("success", "Sugerencia de Cuota: Se ha cargado un fondo decorativo espectacular en HD basado en tu prompt debido a límites temporales del servidor Gemini.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Playback engine
  const startPreviewPlayback = async () => {
    if (isPlayingPreview) {
      stopPreviewPlayback();
    }

    try {
      setIsSynthesizing(true);
      
      // 1. Initialize custom sound nodes first
      const graph = buildAudioSystem(config.backgroundNoise, config.backgroundNoiseVolume);
      
      // Mute the background noise gain temporarily so it doesn't hum while fetching synthesis
      const originalNoiseVol = graph.noiseGain.gain.value;
      graph.noiseGain.gain.setValueAtTime(0, graph.ctx.currentTime);
      
      let audioBuffer: AudioBuffer | null = null;
      let usedGemini = false;
      
      try {
        audioBuffer = await synthesizeScriptToAudioBuffer(scriptText, config.voiceId, graph.ctx);
        usedGemini = true;
      } catch (err) {
        console.warn("Gemini TTS synthesis failed, falling back to local speech engine:", err);
      }
      
      // Restore configured noise volume
      graph.noiseGain.gain.setValueAtTime(originalNoiseVol, graph.ctx.currentTime);
      setIsSynthesizing(false);

      // 2. Add dynamic compression sub-bass if configured
      if (config.subBassSustained) {
        addSubBassSynthesizer(graph, config.subBassIntensity);
      }

      // 3. Connect analyser node for reactive visualizer lines
      const analyser = graph.ctx.createAnalyser();
      analyser.fftSize = 256;
      graph.masterGain.connect(analyser);

      audioGraphRef.current = graph;
      analyserNodeRef.current = analyser;
      setIsPlayingPreview(true);

      let recordDurationSec = config.duration;

      // 4. Play voice & synchronize
      if (audioBuffer && usedGemini) {
        const sourceNode = graph.ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(graph.voiceGain);
        sourceNode.start(0);

        recordDurationSec = audioBuffer.duration;

        sourceNode.onended = () => {
          stopPreviewPlayback();
        };
      } else {
        // Fallback to local browser WebSpeech speechSynthesis
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel(); // reset prior utterances

          const utterance = new SpeechSynthesisUtterance(scriptText);
          utterance.rate = config.speed;
          utterance.pitch = config.pitch;
          
          if (selectedVoiceObj) {
            utterance.voice = selectedVoiceObj;
          }

          // Trigger procedural synched voxel pulses to make spectogram bump on speaking transitions
          utterance.onboundary = (e) => {
            if (e.name === "word") {
              triggerProceduralVoicePulse(0.18 + Math.random() * 0.1);
            }
          };

          utterance.onend = () => {
            stopPreviewPlayback();
          };

          window.speechSynthesis.speak(utterance);
        }
      }

      // Safeguard duration countdown timer based on calculated speech duration
      const totalMs = recordDurationSec * 1050; // extra padding
      playTimerRef.current = setTimeout(() => {
        stopPreviewPlayback();
      }, totalMs);

    } catch (e: any) {
      setIsSynthesizing(false);
      showAlert("error", "Error al inicializar el motor de audio: " + e.message);
    }
  };

  const stopPreviewPlayback = () => {
    setIsPlayingPreview(false);
    
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (audioGraphRef.current) {
      // Stop ambient track oscillators
      audioGraphRef.current.activeNodes.forEach(node => {
        try { node.stop(); } catch (err) {}
      });
      try {
        audioGraphRef.current.ctx.close();
      } catch (err) {}
      audioGraphRef.current = null;
    }
    analyserNodeRef.current = null;
  };

  // Universal Production Generation (Captures Canvas and routes Synthesized sound tracks)
  const handleProduceProduction = async (type: "audio" | "video") => {
    if (isRecording) return;
    if (!scriptText.trim()) {
      showAlert("error", "Ingresa un guión o texto para poder iniciar la producción.");
      return;
    }

    setIsRecording(true);
    setRecordingProgress(5);

    try {
      // Warm up soundscapes
      const graph = buildAudioSystem(config.backgroundNoise, config.backgroundNoiseVolume);
      
      if (config.subBassSustained) {
        addSubBassSynthesizer(graph, config.subBassIntensity);
      }

      const analyser = graph.ctx.createAnalyser();
      analyser.fftSize = 256;
      graph.masterGain.connect(analyser);

      audioGraphRef.current = graph;
      analyserNodeRef.current = analyser;
      setIsPlayingPreview(true);

      // Synthesize high-fidelity voice from Gemini
      setRecordingProgress(15);
      showAlert("success", "Sintetizando voz Premium con Inteligencia Artificial...");
      
      let audioBuffer: AudioBuffer | null = null;
      let usedGemini = false;
      
      try {
        audioBuffer = await synthesizeScriptToAudioBuffer(scriptText, config.voiceId, graph.ctx);
        usedGemini = true;
      } catch (err) {
        console.warn("Fallback to WebSpeech active inside production recorder:", err);
      }

      setRecordingProgress(30);

      // Configured recording duration SECONDS or the audio length
      let recordDurationSec = config.duration;
      if (audioBuffer && usedGemini) {
        recordDurationSec = audioBuffer.duration;
        showAlert("success", `Iniciando grabación (${recordDurationSec.toFixed(1)}s de audio detectados)...`);
      }

      // Start recording from stream
      const destStream = graph.destination.stream;
      let combinedStream = new MediaStream();

      if (type === "video") {
        const canvas = document.getElementById("production-canvas") as HTMLCanvasElement;
        if (canvas) {
          const fps = 25;
          const canvasStream = canvas.captureStream(fps);
          canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
          destStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
        } else {
          combinedStream = destStream;
        }
      } else {
        combinedStream = destStream;
      }

      // Use the highest-compatibility container and codec supported by the browser for WhatsApp sending
      let mimeType = "";
      let ext = "mp4";

      // Check support fallbacks
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder no está soportado en este navegador de internet.");
      }

      if (type === "video") {
        const videoTypes = [
          "video/mp4;codecs=h264,aac",
          "video/mp4;codecs=h264",
          "video/mp4",
          "video/webm;codecs=h264,opus",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm"
        ];
        const supported = videoTypes.find(t => MediaRecorder.isTypeSupported(t));
        mimeType = supported || "video/webm";
        ext = "mp4";
      } else {
        const audioTypes = [
          "audio/mp3",
          "audio/mpeg",
          "audio/mp4",
          "audio/wav",
          "audio/webm;codecs=opus",
          "audio/webm"
        ];
        const supported = audioTypes.find(t => MediaRecorder.isTypeSupported(t));
        mimeType = supported || "audio/webm;codecs=opus";
        ext = "mp3"; 
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, { mimeType });
      } catch (e) {
        // Safe fallback
        recorder = new MediaRecorder(combinedStream);
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Stop handle to prevent race conditions
      let recorderFinished = false;
      const finishRecording = () => {
        if (recorderFinished) return;
        recorderFinished = true;
        try {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        } catch (err) {}
      };

      // Define standard onstop callback to process recordings with zero race conditions
      recorder.onstop = async () => {
        setRecordingProgress(100);
        
        // Stop audio tracks
        try {
          combinedStream.getTracks().forEach(track => track.stop());
        } catch (e) {}

        const rawBlob = new Blob(chunks, {
          type: mimeType || (type === "video" ? "video/webm" : "audio/webm"),
        });

        let fileUrl = URL.createObjectURL(rawBlob);
        let downloadExt = type === "video" ? "webm" : "webm"; // default fallback in case transcoding fails

        try {
          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const resStr = reader.result as string;
              resolve(resStr.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(rawBlob);
          });
          
          const base64Data = await base64Promise;
          
          // Show alert for the processing step
          showAlert("success", `Optimizando formato de ${type === "video" ? "video MP4" : "audio MP3"} para WhatsApp...`);
          
          const transcodeRes = await fetch("/api/transcode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Data, type })
          });
          
          if (transcodeRes.ok) {
            const resData = await transcodeRes.json();
            if (resData.success && resData.base64Data) {
              // Extract base64 payload
              const base64Parts = resData.base64Data.split(",");
              const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
              
              // Decode base64 to binary characters safely
              const binaryCharacters = atob(rawBase64);
              const bytes = new Uint8Array(binaryCharacters.length);
              for (let i = 0; i < binaryCharacters.length; i++) {
                bytes[i] = binaryCharacters.charCodeAt(i);
              }
              
              const responseMime = resData.mimeType || (type === "video" ? "video/mp4" : "audio/mp3");
              const transcodedBlob = new Blob([bytes], { type: responseMime });
              
              // Construct extremely reliable client-side compatible Blob URL
              fileUrl = URL.createObjectURL(transcodedBlob);
              downloadExt = type === "video" ? "mp4" : "mp3"; // Success transcode extension
              showAlert("success", `¡Listo! Archivo de alta calidad ${type === "video" ? "MP4 (H.264)" : "MP3"} listo para descargar.`);
            } else {
              console.warn("Server transcoding fallback triggered:", resData.message || resData.error);
              showAlert("success", "Se descargará en formato nativo WebM por compatibilidad.");
            }
          } else {
            console.warn("Transcoding API responded with error status.");
            showAlert("success", "Se descargará en formato nativo WebM debido a un problema de cuota o procesamiento.");
          }
        } catch (transcodeErr) {
          console.error("Failed to run transcoding, downloaded native format content.", transcodeErr);
        }

        // Append to user results history list for download and persistent playback
        const historyItem: GenerationHistoryItem = {
          id: String(Date.now()),
          type,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
          text: scriptText,
          imageUrl: type === "video" ? (videoUrl ? "video" : imageUrl) : undefined, // flag video preview in history
          duration: recordDurationSec,
          config: { ...config, duration: recordDurationSec },
          mediaUrl: fileUrl,
        };

        setHistoryList(prev => [historyItem, ...prev]);
        setIsRecording(false);
        setIsPlayingPreview(false);
        showAlert("success", `¡Producción de ${type.toUpperCase()} completada con éxito!`);

        // Auto trigger downloading
        const downAnchor = document.createElement("a");
        downAnchor.href = fileUrl;
        downAnchor.download = `produccion_${type}_${Date.now()}.${downloadExt}`;
        document.body.appendChild(downAnchor);
        downAnchor.click();
        document.body.removeChild(downAnchor);
      };

      // Play the actual sound track
      if (audioBuffer && usedGemini) {
        const sourceNode = graph.ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(graph.voiceGain);
        sourceNode.start(0);

        // Auto trigger stop when vocal track ends
        sourceNode.onended = () => {
          finishRecording();
        };
      } else {
        // Trigger WebSpeech API speaking concurrently as fallback
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(scriptText);
          utterance.rate = config.speed;
          utterance.pitch = config.pitch;
          if (selectedVoiceObj) utterance.voice = selectedVoiceObj;

          utterance.onboundary = (e) => {
            if (e.name === "word") {
              triggerProceduralVoicePulse(0.2);
            }
          };
          utterance.onend = () => {
            finishRecording();
          };

          window.speechSynthesis.speak(utterance);
        }
      }

      // Start capture
      recorder.start();

      // progress simulation bar
      const intervalSecs = 0.5;
      let currentSecs = 0;
      const progressInterval = setInterval(() => {
        currentSecs += intervalSecs;
        const ratio = currentSecs / recordDurationSec;
        const percentage = Math.min(30 + Math.round(ratio * 65), 95);
        setRecordingProgress(percentage);
        
        // mouth visual vibrations
        triggerProceduralVoicePulse(0.25);

        if (currentSecs >= recordDurationSec) {
          clearInterval(progressInterval);
          finishRecording();
        }
      }, intervalSecs * 1000);

    } catch (e: any) {
      setIsRecording(false);
      setIsPlayingPreview(false);
      showAlert("error", "Error durante el renderizado de la cinta: " + e.message);
    }
  };

  // Batch processing of all uploaded custom gallery assets in a queue
  const handleBatchProduceAll = async (type: "audio" | "video") => {
    if (isRecording || batchState.isActive) return;
    if (!scriptText.trim()) {
      showAlert("error", "Ingresa un guión o texto para poder iniciar la producción en lote.");
      return;
    }

    const queuePresets: { name: string; imageUrl: string; videoUrl: string; label: string }[] = [];
    
    // Add custom photos to queue
    customPhotos.forEach((item, index) => {
      queuePresets.push({
        name: `custom_foto_${index + 1}`,
        imageUrl: item.url,
        videoUrl: "",
        label: `Foto ${index + 1}: ${item.name.slice(0, 15)}...`
      });
    });

    // Add custom videos to queue
    customVideos.forEach((item, index) => {
      queuePresets.push({
        name: `custom_video_${index + 1}`,
        imageUrl: "",
        videoUrl: item.url,
        label: `Video ${index + 1}: ${item.name.slice(0, 15)}...`
      });
    });

    // Fallback to beautiful templates if none uploaded
    if (queuePresets.length === 0) {
      queuePresets.push(
        {
          name: "01_abstract_art",
          imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
          videoUrl: "",
          label: "Fondo Abstracto Inicial"
        },
        {
          name: "02_femenina_estudio",
          imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
          videoUrl: "",
          label: "Locutora Femenina de Estudio"
        },
        {
          name: "03_masculino_retrato",
          imageUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&auto=format&fit=crop",
          videoUrl: "",
          label: "Modelo Masculino Expresivo"
        },
        {
          name: "04_neon_abstracto",
          imageUrl: "",
          videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41851-large.mp4",
          label: "Fondo Láser Neón Loop"
        },
        {
          name: "05_ondas_cyber",
          imageUrl: "",
          videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-blue-and-pink-stripes-31952-large.mp4",
          label: "Ondas Cyber Retro Loop"
        }
      );
    }

    // Limit active queue to maximum 5 items as requested
    const activeQueue = queuePresets.slice(0, 5);

    // Backup current background states to restore after batch completion
    const initialImgUrl = imageUrl;
    const initialImgFile = imageFile;
    const initialVidUrl = videoUrl;
    const initialVidFile = videoFile;

    setIsRecording(true);
    setBatchState({
      isActive: true,
      currentIndex: 0,
      progress: 0,
      message: "Inicializando la cola de producción en lote...",
      totalItems: activeQueue.length,
    });

    const zip = new JSZip();
    
    try {
      // 1. Synthesize the voice ONCE for the entire batch to conserve API quota and match timing perfectly
      setBatchState(prev => ({
        ...prev,
        message: "Sintetizando voz de alta fidelidad con IA para el lote...",
        progress: 3,
      }));

      let rawAudioBytes: Uint8Array | null = null;
      let usedGemini = false;
      
      try {
        rawAudioBytes = await synthesizeScriptToUint8Array(scriptText, config.voiceId);
        usedGemini = true;
      } catch (err) {
        console.warn("Batch speech synthesis fallback activated:", err);
      }

      let calculatedDurationSec = config.duration;
      if (rawAudioBytes && usedGemini) {
        const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        try {
          const tempBuffer = await tempCtx.decodeAudioData(rawAudioBytes.buffer.slice(0));
          calculatedDurationSec = tempBuffer.duration;
        } catch (e) {
          console.warn("Failed to decode batch audio template duration:", e);
        }
        await tempCtx.close();
      }

      setBatchState(prev => ({
        ...prev,
        message: "¡Voz Premium sintetizada! Iniciando grabación secuencial...",
        progress: 8,
      }));

      // 2. Loop through each item in the queue
      for (let i = 0; i < activeQueue.length; i++) {
        const preset = activeQueue[i];
        
        // Progress weight distribution: 8% initial synthesis, remaining 92% split equally
        const pctSlice = i * (88 / activeQueue.length) + 8;
        const endPctSlice = (i + 1) * (88 / activeQueue.length) + 8;
        
        setBatchState(prev => ({
          ...prev,
          currentIndex: i,
          progress: pctSlice,
          message: `Preparando pieza ${i + 1}/${activeQueue.length}: ${preset.label}...`,
        }));

        // Set active media backgrounds
        setImageUrl(preset.imageUrl);
        setImageFile(null);
        setVideoUrl(preset.videoUrl);
        setVideoFile(null);

        // Allow layout to fully repaint and media files to seek
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Processing wrap promise
        const chunkPromise = new Promise<{ blob: Blob; ext: string }>(async (resolveItem, rejectItem) => {
          let progressInterval: any;
          let recordingTimeout: any;
          let recorder: MediaRecorder;
          const graph = buildAudioSystem(config.backgroundNoise, config.backgroundNoiseVolume);

          let batchAudioBuffer: AudioBuffer | null = null;
          if (rawAudioBytes && usedGemini) {
            try {
              const arrayBufferCopy = rawAudioBytes.buffer.slice(0);
              batchAudioBuffer = await graph.ctx.decodeAudioData(arrayBufferCopy);
            } catch (err) {
              console.error("Failed to decode batch audio in loop item:", err);
            }
          }

          const cleanup = () => {
            if (progressInterval) clearInterval(progressInterval);
            if (recordingTimeout) clearTimeout(recordingTimeout);
            if (typeof window !== "undefined" && window.speechSynthesis) {
              window.speechSynthesis.cancel();
            }
            if (audioGraphRef.current) {
              audioGraphRef.current.activeNodes.forEach(node => {
                try { node.stop(); } catch (err) {}
              });
              try { audioGraphRef.current.ctx.close(); } catch (err) {}
              audioGraphRef.current = null;
            }
            analyserNodeRef.current = null;
            setIsPlayingPreview(false);
          };

          try {
            if (config.subBassSustained) {
              addSubBassSynthesizer(graph, config.subBassIntensity);
            }

            const analyser = graph.ctx.createAnalyser();
            analyser.fftSize = 256;
            graph.masterGain.connect(analyser);

            audioGraphRef.current = graph;
            analyserNodeRef.current = analyser;
            setIsPlayingPreview(true);

            const destStream = graph.destination.stream;
            let combinedStream = new MediaStream();

            if (type === "video") {
              const canvas = document.getElementById("production-canvas") as HTMLCanvasElement;
              if (canvas) {
                const fps = 25;
                const canvasStream = canvas.captureStream(fps);
                canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
                destStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
              } else {
                combinedStream = destStream;
              }
            } else {
              combinedStream = destStream;
            }

            let mimeType = "";
            let ext = "mp4";

            if (type === "video") {
              const videoTypes = [
                "video/mp4;codecs=h264,aac",
                "video/mp4;codecs=h264",
                "video/mp4",
                "video/webm;codecs=h264,opus",
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/webm"
              ];
              const supported = videoTypes.find(t => MediaRecorder.isTypeSupported(t));
              mimeType = supported || "video/webm";
              ext = "mp4";
            } else {
              const audioTypes = [
                "audio/mp3",
                "audio/mpeg",
                "audio/mp4",
                "audio/wav",
                "audio/webm;codecs=opus",
                "audio/webm"
              ];
              const supported = audioTypes.find(t => MediaRecorder.isTypeSupported(t));
              mimeType = supported || "audio/webm;codecs=opus";
              ext = "mp3";
            }

            try {
              recorder = new MediaRecorder(combinedStream, { mimeType });
            } catch (e) {
              recorder = new MediaRecorder(combinedStream);
            }

            const chunks: Blob[] = [];
            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            let itemFinished = false;
            const finishItemRecording = () => {
              if (itemFinished) return;
              itemFinished = true;
              try {
                if (recorder.state !== "inactive") {
                  recorder.stop();
                }
              } catch (err) {}
            };

            recorder.onstop = async () => {
              // Stop tracks
              try {
                combinedStream.getTracks().forEach(tr => tr.stop());
              } catch (e) {}

              const rawBlob = new Blob(chunks, {
                type: mimeType || (type === "video" ? "video/webm" : "audio/webm"),
              });

              let outputBlob = rawBlob;
              let finalExt = type === "video" ? "webm" : "webm";

              try {
                setBatchState(prev => ({
                  ...prev,
                  message: `Pieza ${i+1}/${activeQueue.length}: Optimizando formato ${type === "video" ? "MP4" : "MP3"} para WhatsApp...`,
                }));

                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolveFile, rejectFile) => {
                  reader.onloadend = () => {
                    const resStr = reader.result as string;
                    resolveFile(resStr.split(",")[1]);
                  };
                  reader.onerror = rejectFile;
                  reader.readAsDataURL(rawBlob);
                });

                const base64Data = await base64Promise;

                const transcodeRes = await fetch("/api/transcode", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ base64Data, type })
                });

                if (transcodeRes.ok) {
                  const resData = await transcodeRes.json();
                  if (resData.success && resData.base64Data) {
                    const base64Parts = resData.base64Data.split(",");
                    const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];
                    const binaryCharacters = atob(rawBase64);
                    const bytes = new Uint8Array(binaryCharacters.length);
                    for (let j = 0; j < binaryCharacters.length; j++) {
                      bytes[j] = binaryCharacters.charCodeAt(j);
                    }
                    const responseMime = resData.mimeType || (type === "video" ? "video/mp4" : "audio/mp3");
                    outputBlob = new Blob([bytes], { type: responseMime });
                    finalExt = type === "video" ? "mp4" : "mp3";
                  }
                }
              } catch (transcodeErr) {
                console.error("Transcode failed in batch, keeping raw format.", transcodeErr);
              }

              cleanup();
              resolveItem({ blob: outputBlob, ext: finalExt });
            };

            // Play the shared synthesized audio
            if (batchAudioBuffer && usedGemini) {
              const sourceNode = graph.ctx.createBufferSource();
              sourceNode.buffer = batchAudioBuffer;
              sourceNode.connect(graph.voiceGain);
              sourceNode.start(0);

              sourceNode.onended = () => {
                finishItemRecording();
              };
            } else {
              // Local fallback Speech
              if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(scriptText);
                utterance.rate = config.speed;
                utterance.pitch = config.pitch;
                if (selectedVoiceObj) utterance.voice = selectedVoiceObj;

                utterance.onboundary = (e) => {
                  if (e.name === "word") {
                    triggerProceduralVoicePulse(0.2);
                  }
                };
                utterance.onend = () => {
                  finishItemRecording();
                };

                window.speechSynthesis.speak(utterance);
              }
            }

            recorder.start();

            // Progress tick simulation
            let steps = 0;
            const progressTicks = 12;
            progressInterval = setInterval(() => {
              steps++;
              const stepRatio = steps / progressTicks;
              const sliceWidth = endPctSlice - pctSlice;
              const currentPct = pctSlice + stepRatio * sliceWidth * 0.85;
              setBatchState(prev => ({
                ...prev,
                progress: Math.min(currentPct, endPctSlice - 2),
                message: `Pieza ${i+1}/${activeQueue.length}: Capturando lienzo (${Math.round(stepRatio * 100)}%)...`,
              }));
              triggerProceduralVoicePulse(0.25);
            }, (calculatedDurationSec * 1000) / progressTicks);

            recordingTimeout = setTimeout(() => {
              clearInterval(progressInterval);
              finishItemRecording();
            }, calculatedDurationSec * 1050);

          } catch (eOuter) {
            cleanup();
            rejectItem(eOuter);
          }
        });

        // Resolve item promise
        const { blob, ext } = await chunkPromise;

        // Add history item
        const fileUrl = URL.createObjectURL(blob);
        const historyItem: GenerationHistoryItem = {
          id: `${Date.now()}_batch_${i}`,
          type,
          timestamp: new Date().toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }),
          text: `[LOTE ${i+1}/${activeQueue.length}] ${scriptText}`,
          imageUrl: type === "video" ? (preset.videoUrl ? "video" : preset.imageUrl) : undefined,
          duration: calculatedDurationSec,
          config: { ...config, duration: calculatedDurationSec },
          mediaUrl: fileUrl,
        };
        setHistoryList(prev => [historyItem, ...prev]);

        // Place into zip
        zip.file(`${preset.name}.${ext}`, blob);

        setBatchState(prev => ({
          ...prev,
          progress: endPctSlice,
          message: `Pieza ${i+1}/${activeQueue.length} completada con éxito.`,
        }));
      }

      setBatchState(prev => ({
        ...prev,
        progress: 96,
        message: "Compilando carpeta del paquete (.ZIP) firmado...",
      }));

      const zipContent = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipContent);

      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = `paquete_lote_${type}_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert("success", `¡Lote de ${activeQueue.length} ${type === "video" ? "videos" : "audios"} generado exitosamente en un archivo ZIP!`);
    } catch (err: any) {
      console.error("Batch processing error:", err);
      showAlert("error", "Error en procesamiento por lote: " + err.message);
    } finally {
      // Restore initial state
      setImageUrl(initialImgUrl);
      setImageFile(initialImgFile);
      setVideoUrl(initialVidUrl);
      setVideoFile(initialVidFile);

      setIsRecording(false);
      setBatchState({
        isActive: false,
        currentIndex: 0,
        progress: 0,
        message: "",
        totalItems: 0,
      });
    }
  };

  // Apply Preset parameters
  const applyPresetParameters = (pConfig: Partial<GeneratorConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...pConfig,
    }));
    showAlert("success", "Modulación física y atmósfera acústica ajustada.");
  };

  return (
    <div className="min-h-screen bg-stone-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300" id="main-application-wrap">
      {/* Top Professional Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 w-full"></div>

      {/* Main Header Nav */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur px-6 py-4 flex items-center justify-between gap-4" id="app-nav-header">
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 font-bold" id="app-logo">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wider uppercase text-neutral-100 font-sans flex items-center gap-1.5 matches-title">
              Estudio Ultra-Sónico <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">V1.5</span>
            </h1>
            <p className="text-[11px] text-neutral-400 max-w-sm">
              Producción unificada de audio, sub-bajo cinemático y video con IA.
            </p>
          </div>
        </div>

        {/* Global Batch Render Progress Monitor */}
        {batchState.isActive && (
          <div className="flex-1 max-w-sm lg:max-w-md bg-neutral-900/90 border border-emerald-500/15 rounded-lg p-2.5 flex flex-col gap-1.5 animate-pulse-slow font-sans" id="batch-progress-header">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                <span>RENDERIZADO LOTE CENTRAL ({batchState.currentIndex + 1}/{batchState.totalItems || 5})</span>
              </span>
              <span className="text-emerald-400 font-bold font-mono text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {Math.round(batchState.progress)}%
              </span>
            </div>
            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-850">
              <div 
                className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 h-full transition-all duration-300 rounded-full" 
                style={{ width: `${batchState.progress}%` }}
              />
            </div>
            <p className="text-[9px] text-neutral-400 font-mono flex items-center gap-1 truncate">
              <span className="text-emerald-400 shrink-0">▸</span> {batchState.message}
            </p>
          </div>
        )}

        {/* Global Alert Notification Drawer */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {errorMessage && (
            <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs px-3.5 py-1.5 rounded-lg animate-fade-in" id="top-error-toast">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-xs px-3.5 py-1.5 rounded-lg animate-fade-in" id="top-success-toast">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout Container */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6" id="workspace-grid">
        
        {/* Workspace Alerts for Mobile Screen size */}
        <div className="lg:hidden col-span-1 flex flex-col gap-2" id="mobile-alert-holder">
          {errorMessage && (
            <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs px-3 py-2 rounded-lg" id="mobile-error-toast">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-xs px-3 py-2 rounded-lg" id="mobile-success-toast">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Left Control Dashboard Grid Panel (7 cols wide) */}
        <div className="lg:col-span-7 flex flex-col gap-6" id="creation-controls-pane">
          
          {/* Module 1: Script script generation panel */}
          <section className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-5" id="script-input-module">
            <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <h3 className="font-sans font-semibold text-neutral-100 text-xs uppercase tracking-wider">
                  1. Redacción del Guión o Mensaje
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500">
                {scriptText.length} caracteres
              </span>
            </div>

            <textarea
              id="script-textarea"
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Escribe el texto de narración aquí para que el sintetizador vocal lo traduzca a ondas de sonido síncronas..."
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500/50 rounded-lg p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all font-sans leading-relaxed resize-none"
            />

            {/* Sub-panel: AI Script Enhancer using Gemini */}
            <div className="mt-4 bg-neutral-950/50 border border-neutral-800/80 rounded-lg p-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <Wand2 className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-semibold font-sans">Optimizar Guión con Gemini-3.5</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 font-mono">Tono:</span>
                  <select
                    id="select-script-mood"
                    value={moodStyle}
                    onChange={(e) => setMoodStyle(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 rounded px-2 py-1 focus:outline-none focus:border-emerald-500/40"
                  >
                    <option value="profesional y cálido">Profesional y Cálido</option>
                    <option value="dramático y profundo">Dramático y Misterioso</option>
                    <option value="enérgico y comercial">Enérgico y Comercial</option>
                    <option value="zen y meditativo">Zen y Meditativo</option>
                  </select>
                </div>
              </div>
              
              <p className="text-[10px] text-neutral-500 mt-1.5 font-sans leading-normal">
                Gemini reestructurará tu texto para adecuarlo exactamente a los <span className="text-emerald-400 font-semibold">{config.duration} segundos</span> elegidos, optimizando el ritmo de lectura.
              </p>

              <button
                id="btn-enhance-script"
                onClick={handleEnhanceScript}
                disabled={isEnhancingText || !scriptText.trim()}
                type="button"
                className="mt-3 w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/20 text-neutral-300 hover:text-white font-semibold text-xs py-2 rounded transition-all cursor-pointer disabled:opacity-50"
              >
                {isEnhancingText ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Optimizando guión...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5 text-yellow-400" />
                    Ejecutar Algoritmo de Pulido IA
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Module 2: Image & Video Background Upload & AI Lip Sync Config */}
          <section className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-5" id="image-selection-module">
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-400" />
                <h3 className="font-sans font-semibold text-neutral-100 text-xs uppercase tracking-wider">
                  2. Multimedia de Fondo (Fotografía o Video)
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                {videoUrl ? "MODO VIDEO" : "MODO FOTO"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Drag & Drop Upload Space */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-neutral-850 hover:border-emerald-500/30 rounded-lg p-4 bg-neutral-950/40 text-center flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-neutral-950/60 relative group min-h-[140px]"
                id="media-dropzone"
              >
                <input
                  type="file"
                  id="media-file-input"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                
                <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-805 text-neutral-400 group-hover:text-emerald-400 transition-all mb-2">
                  <Upload className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-neutral-300">Arrastra Imagen o Video</span>
                <span className="text-[10px] text-neutral-500 mt-1">Soporta PNG, WEBP, MP4 o WEBM</span>
              </div>

              {/* AI Image Generation Prompt Column */}
              <div className="flex flex-col justify-between bg-neutral-955 border border-neutral-850 p-4 rounded-lg">
                <div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-neutral-300 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Lanzador de Fondos IA</span>
                  </div>
                  <input
                    id="input-ai-image-prompt"
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe una idea visual cinematográfica..."
                    className="w-full bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 rounded p-2 focus:outline-none focus:border-emerald-500/40 font-sans"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1 font-sans leading-normal">
                    Genera una imagen artística en 16:9 con <span className="text-neutral-300 font-mono">gemini-2.5-flash-image</span>.
                  </p>
                </div>

                <button
                  id="btn-generate-ai-img"
                  onClick={handleGenerateAiImage}
                  disabled={isGeneratingImage || !aiPrompt.trim()}
                  type="button"
                  className="mt-3 w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-[11px] py-1.5 px-3 rounded shadow hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingImage ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-neutral-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando fondo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generar Imagen con IA
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Presets Gallery Section with custom Photos and Videos (up to 5 each) */}
            <div className="mt-4 pt-4 border-t border-neutral-800/80" id="media-preset-gallery">
              <span className="block text-[11px] font-semibold text-neutral-400 font-mono tracking-wider uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Galería de Fotos ({customPhotos.length}/5)</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-normal">Máx 5 fotos (Soltar archivos arriba o usar predeterminadas)</span>
              </span>
              
              <div className="grid grid-cols-5 gap-2.5 mb-5">
                {customPhotos.map((photo) => {
                  const isActive = imageUrl === photo.url;
                  return (
                    <div 
                      key={photo.id}
                      className={`group relative h-16 rounded-lg overflow-hidden border transition-all ${
                        isActive ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-neutral-900 hover:border-neutral-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setVideoUrl("");
                          setVideoFile(null);
                          setImageFile(photo.file);
                          setImageUrl(photo.url);
                          showAlert("success", `Foto activa: "${photo.name}"`);
                        }}
                        className="w-full h-full text-left bg-transparent p-0 cursor-pointer block relative"
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </button>
                      <button
                        type="button"
                        title="Eliminar Foto"
                        onClick={() => {
                          setCustomPhotos(prev => prev.filter(p => p.id !== photo.id));
                          if (isActive) {
                            setImageUrl("");
                            setImageFile(null);
                          }
                          showAlert("success", "Foto eliminada de la galería.");
                        }}
                        className="absolute top-1 right-1 h-5 w-5 bg-black/80 hover:bg-red-950/90 text-neutral-400 hover:text-red-400 border border-neutral-800 rounded-md flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {customPhotos.length === 0 && (
                  <div className="col-span-5 py-4 border border-dashed border-neutral-800 rounded-lg text-center text-[10px] text-neutral-500 font-mono">
                    Galería de fotos vacía. Arrastra una imagen para agregarla.
                  </div>
                )}
              </div>

              <span className="block text-[11px] font-semibold text-neutral-400 font-mono tracking-wider uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Galería de Videos ({customVideos.length}/5)</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-normal">Máx 5 videos (Fondo MP4 animado en lote y producción)</span>
              </span>

              <div className="grid grid-cols-5 gap-2.5">
                {customVideos.map((video) => {
                  const isActive = videoUrl === video.url;
                  return (
                    <div 
                      key={video.id}
                      className={`group relative h-16 rounded-lg overflow-hidden border transition-all ${
                        isActive ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-neutral-900 hover:border-neutral-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl("");
                          setImageFile(null);
                          setVideoFile(video.file);
                          setVideoUrl(video.url);
                          showAlert("success", `Video activo: "${video.name}"`);
                        }}
                        className="w-full h-full bg-neutral-950 hover:bg-neutral-900 transition-colors relative flex flex-col items-center justify-center p-0 cursor-pointer"
                      >
                        <span className="text-base">🎬</span>
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 px-1 text-[8px] text-neutral-300 truncate text-center">
                          {video.name}
                        </div>
                      </button>
                      <button
                        type="button"
                        title="Eliminar Video"
                        onClick={() => {
                          setCustomVideos(prev => prev.filter(v => v.id !== video.id));
                          if (isActive) {
                            setVideoUrl("");
                            setVideoFile(null);
                          }
                          showAlert("success", "Video eliminado de la galería.");
                        }}
                        className="absolute top-1 right-1 h-5 w-5 bg-black/80 hover:bg-red-950/90 text-neutral-400 hover:text-red-400 border border-neutral-800 rounded-md flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {customVideos.length === 0 && (
                  <div className="col-span-5 py-4 border border-dashed border-neutral-800 rounded-lg text-center text-[10px] text-neutral-500 font-mono">
                    Galería de videos vacía. Arrastra un video para agregarlo.
                  </div>
                )}
              </div>
            </div>

            {/* Selected Background Preview Segment */}
            {(imageUrl || videoUrl) && (
              <div className="mt-3 bg-neutral-950 border border-neutral-850 p-2 rounded-lg flex items-center gap-3">
                <div className="h-10 w-16 bg-neutral-900 border border-neutral-800 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {videoUrl ? (
                    <div className="text-emerald-400 font-bold text-[10px] font-mono select-none px-1">VIDEO HD</div>
                  ) : (
                    <img src={imageUrl} alt="preview" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-mono text-neutral-500 uppercase">Fondo activo</span>
                  <span className="block text-xs font-semibold text-neutral-300 truncate">
                    {videoUrl ? (videoFile ? videoFile.name : "Video de Fondo Subido") : (imageFile ? imageFile.name : "Renderizado IA")}
                  </span>
                </div>
                <button
                  id="btn-remove-media"
                  onClick={() => {
                    setImageUrl("");
                    setImageFile(null);
                    setVideoUrl("");
                    setVideoFile(null);
                    showAlert("success", "Fondo multimedia removido.");
                  }}
                  className="text-xs text-neutral-500 hover:text-rose-400 p-1.5 underline bg-transparent cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            )}

            {/* Sincronización Labial Sub-Module (Only valid for photographs) */}
            {!videoUrl && (
              <div className="mt-4 bg-neutral-950/70 border border-neutral-850 rounded-lg p-4" id="lip-sync-submodule">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-xs font-semibold text-neutral-300">Sincronización Labial de Fotos</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.lipSyncEnabled}
                      onChange={(e) => setConfig(prev => ({ ...prev, lipSyncEnabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-neutral-405 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-rose-500 peer-checked:after:bg-white"></div>
                  </label>
                </div>

                {config.lipSyncEnabled && (
                  <div className="space-y-3 pt-2 text-[10px] text-neutral-450 border-t border-neutral-850/60 font-sans">
                    <p className="leading-relaxed">
                      La gesticulación facial se simula de manera procedimental ligada a las frecuencias vocales en tiempo real. 
                      <span className="text-rose-400 ml-1 font-semibold">Haz clic directo en cualquier parte de la foto de previsualización para posicionar la boca.</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-neutral-500 font-mono mb-1">
                          <span>Alineación Horizontal (X)</span>
                          <span>{(config.mouthX * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={config.mouthX}
                          onChange={(e) => setConfig(prev => ({ ...prev, mouthX: parseFloat(e.target.value) }))}
                          className="w-full accent-rose-500 bg-neutral-900 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-neutral-500 font-mono mb-1">
                          <span>Alineación Vertical (Y)</span>
                          <span>{(config.mouthY * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={config.mouthY}
                          onChange={(e) => setConfig(prev => ({ ...prev, mouthY: parseFloat(e.target.value) }))}
                          className="w-full accent-rose-500 bg-neutral-900 border border-neutral-800 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, mouthX: 0.5, mouthY: 0.65 }))}
                        className="text-[9px] text-neutral-500 hover:text-neutral-300 font-semibold font-mono underline bg-transparent"
                      >
                        RESTABLECER POSICIÓN DEFECTO
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Module 3: Audio Preset Physics selectors */}
          <PresetsSelector onSelectPreset={applyPresetParameters} currentConfig={config} />

          {/* Module 4: Sliders Configuration / Ajustes Avanzados */}
          <section className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-5" id="advanced-sliders-module">
            <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-3">
              <Sliders className="h-4 w-4 text-emerald-400" />
              <h3 className="font-sans font-semibold text-neutral-100 text-xs uppercase tracking-wider">
                3. Modulación de Audio, Atmosferas y Límites
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left sliders group: Voice physical dimensions */}
              <div className="flex flex-col gap-4.5" id="voice-sliders-col">
                <h4 className="text-[11px] font-semibold text-neutral-400 font-mono tracking-wider uppercase">
                  Dimensiones de la Voz
                </h4>
                
                {/* Voice model selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-300 font-sans flex items-center justify-between">
                    <span>Modelo de Voz / Hablante</span>
                    <span className="text-[10px] text-neutral-500 italic">browser native</span>
                  </label>
                  <select
                    id="select-voice-speaker"
                    value={selectedVoiceObj?.name || ""}
                    onChange={(e) => {
                      const v = browserVoices.find(voice => voice.name === e.target.value);
                      if (v) {
                        setSelectedVoiceObj(v);
                        showAlert("success", `Voz cambiada a: ${v.name}`);
                      }
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 rounded-lg p-2.5 focus:outline-none focus:border-emerald-500/40"
                  >
                    {browserVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                    {browserVoices.length === 0 && (
                      <option value="">No se encontraron voces nativas</option>
                    )}
                  </select>
                </div>

                {/* Speech rate / Velocidad of Habla */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Velocidad de Habla</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">{config.speed}x</span>
                  </div>
                  <input
                    id="slider-speech-speed"
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={config.speed}
                    onChange={(e) => setConfig(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                    <span>Lento (0.5x)</span>
                    <span>Normal (1.0x)</span>
                    <span>Rápido (2.0x)</span>
                  </div>
                </div>

                {/* Voice pitch / Tono of voz */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Tono de Voz</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">{config.pitch}</span>
                  </div>
                  <input
                    id="slider-voice-pitch"
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={config.pitch}
                    onChange={(e) => setConfig(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                    <span>Grueso/Grave (0.5)</span>
                    <span>Natural (1.0)</span>
                    <span>Agudo/Fino (2.0)</span>
                  </div>
                </div>
                
                {/* Voice amplitude Gain / Volumen */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>Volumen Máximo de Voz</span>
                    <span className="text-[11px] font-mono text-neutral-400">{Math.round(config.voiceVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-voice-volume"
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={config.voiceVolume}
                    onChange={(e) => setConfig(prev => ({ ...prev, voiceVolume: parseFloat(e.target.value) }))}
                    className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>

              {/* Right sliders group: Deep Sub-bass & Background Ambient noises */}
              <div className="flex flex-col gap-4.5" id="ambient-sliders-col">
                <h4 className="text-[11px] font-semibold text-neutral-400 font-mono tracking-wider uppercase">
                  Atmosfera Acústica y Osciladores
                </h4>

                {/* Sub-bajo sostenido switch check */}
                <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-300 font-medium">Sub-Bajo Sostenido de G#0 (52Hz)</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="toggle-sub-bass"
                        type="checkbox"
                        checked={config.subBassSustained}
                        onChange={(e) => setConfig(prev => ({ ...prev, subBassSustained: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-neutral-400 peer-checked:after:bg-emerald-400 after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-950/80"></div>
                    </label>
                  </div>
                  
                  {config.subBassSustained && (
                    <div className="flex flex-col gap-1.5 animate-fade-in mt-2 border-t border-neutral-900 pt-2">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span>Ganancia del Canal de Bajos</span>
                        <span className="font-mono text-emerald-400 font-semibold">{Math.round(config.subBassIntensity * 100)}%</span>
                      </div>
                      <input
                        id="slider-sub-bass-intensity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={config.subBassIntensity}
                        onChange={(e) => setConfig(prev => ({ ...prev, subBassIntensity: parseFloat(e.target.value) }))}
                        className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-neutral-500 font-sans mt-1 leading-normal">
                    Inyecta ondas sinusoidales ultra bajas sincronizadas armónicamente con la voz para lograr un grosor de estudio.
                  </p>
                </div>

                {/* Background Noise Select / Ruidos de fondo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-neutral-300 font-sans">
                    Frecuencia de Ruido de Fondo
                  </label>
                  <select
                    id="select-background-noise"
                    value={config.backgroundNoise}
                    onChange={(e) => setConfig(prev => ({ ...prev, backgroundNoise: e.target.value as BackgroundNoiseType }))}
                    className="w-full bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 rounded-lg p-2.5 focus:outline-none focus:border-emerald-500/40"
                  >
                    <option value="none">Ninguno (Silencio Absoluto)</option>
                    <option value="rain">Lluvia de Otoño Fina</option>
                    <option value="drone_espacial">Módulo Espacial (Deep Space Hum)</option>
                    <option value="naturaleza">Bosque y Canto de Frecuencias</option>
                    <option value="cafeteria">Murmullo de Cafetería Social</option>
                    <option value="oficina">Sala de Conferencia Hum</option>
                    <option value="ruido_blanco">Ruido Blanco Puro de Cabina</option>
                  </select>
                </div>

                {/* Background noise volume slider */}
                {config.backgroundNoise !== "none" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-neutral-300">
                      <span>Volumen del Ruido de Fondo</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                        {Math.round(config.backgroundNoiseVolume * 100)}%
                      </span>
                    </div>
                    <input
                      id="slider-noise-volume"
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.02"
                      value={config.backgroundNoiseVolume}
                      onChange={(e) => setConfig(prev => ({ ...prev, backgroundNoiseVolume: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Timeline constraints for overall production */}
            <div className="mt-5 border-t border-neutral-800/80 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-200">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    Tiempo Límite de Producción
                  </span>
                  <span className="text-[12px] font-mono text-emerald-400 font-bold">
                    {config.duration >= 60 ? `${Math.floor(config.duration / 60)}:${config.duration % 60 < 10 ? "0" + (config.duration % 60) : config.duration % 60} minutos` : `${config.duration} segundos`}
                  </span>
                </div>
                <input
                  id="slider-production-duration"
                  type="range"
                  min="5"
                  max="900"
                  step="5"
                  value={config.duration}
                  onChange={(e) => setConfig(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              <div className="flex flex-col gap-1.5 justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-500 font-mono">ESTILO DE LETRAS:</span>
                  <select
                    id="select-subtitle-color"
                    value={config.subtitleColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, subtitleColor: e.target.value }))}
                    className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 rounded px-2 py-0.5"
                  >
                    <option value="#ffffff">Blanco Nítido</option>
                    <option value="#34d399">Esmeralda Neón</option>
                    <option value="#facc15">Amarillo Radiante</option>
                    <option value="#60a5fa">Azul Eléctrico</option>
                  </select>

                  <select
                    id="select-visual-effect"
                    value={config.visualEffect}
                    onChange={(e) => setConfig(prev => ({ ...prev, visualEffect: e.target.value as any }))}
                    className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 rounded px-2 py-0.5"
                  >
                    <option value="audio-spectrogram">Ondas Espectro</option>
                    <option value="pan-zoom">Ken Burns Zoom</option>
                    <option value="ripple">Vibración Ritmo</option>
                    <option value="static">Solo Imagen</option>
                  </select>
                </div>
                <span className="text-[10px] text-neutral-500 font-sans">
                  El tiempo configurado aplica equitativamente para el mezclador de Video y de Audio.
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Output Preview & History Panel (5 cols wide) */}
        <div className="lg:col-span-5 flex flex-col gap-6" id="multimedia-output-pane">
          
          {/* Main Monitor Preview Component */}
          <MultimediaPreview
            text={scriptText}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            isGenerating={isRecording}
            isPlaying={isPlayingPreview}
            progress={recordingProgress}
            onPlay={startPreviewPlayback}
            onStop={stopPreviewPlayback}
            config={config}
            analyserNode={analyserNodeRef.current}
            recordingStream={null}
            onSetMouthPosition={(x, y) => {
              setConfig(prev => ({ ...prev, mouthX: x, mouthY: y }));
              showAlert("success", `Boca reposicionada en: X=${Math.round(x * 100)}%, Y=${Math.round(y * 100)}%`);
            }}
          />

          {/* Core Master Action download triggers */}
          <section className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-5" id="production-download-module">
            <h4 className="font-sans font-semibold text-neutral-100 text-xs uppercase tracking-wider mb-3 pb-3 border-b border-neutral-800 flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-400" />
              Producir y Descargar Archivos Finales
            </h4>
            
            <p className="text-xs text-neutral-400 mb-4 leading-normal font-sans">
              Renderiza en tiempo real las pistas procedimentales, modulación y ondas. Los dos botones te permitirán descargar el lienzo en formato final:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="downloads-grid-layout">
              {/* Button: RECORD ONLY AUDIO */}
              <button
                id="btn-download-audio"
                onClick={() => handleProduceProduction("audio")}
                disabled={isRecording || !scriptText.trim()}
                type="button"
                className="flex flex-col items-center justify-center p-4 bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/35 rounded-xl transition-all group scale-100 hover:scale-102 active:scale-98 cursor-pointer disabled:opacity-50 disabled:scale-100"
              >
                <div className="p-2.5 bg-neutral-950 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform mb-2 border border-neutral-850">
                  <Music className="h-5 w-5" />
                </div>
                <span className="font-sans font-bold text-xs text-neutral-200">
                  Descargar AUDIO MP3
                </span>
                <span className="text-[9px] text-neutral-500 font-sans mt-1 text-center leading-normal">
                  Pista de audio .MP3 con voz, sub-bajos y efectos de fondo
                </span>
              </button>

              {/* Button: RECORD CANVAS VIDEO WITH AUDIO */}
              <button
                id="btn-download-video"
                onClick={() => handleProduceProduction("video")}
                disabled={isRecording || !scriptText.trim()}
                type="button"
                className="flex flex-col items-center justify-center p-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-neutral-950 font-sans font-bold rounded-xl transition-all shadow hover:scale-102 active:scale-98 cursor-pointer disabled:opacity-50 disabled:scale-100"
              >
                <div className="p-2.5 bg-neutral-950/10 rounded-lg text-neutral-950 mb-2">
                  <Video className="h-5 w-5" />
                </div>
                <span>
                  Descargar VIDEO MP4
                </span>
                <span className="text-[9px] text-emerald-950 font-normal mt-1 text-center font-sans leading-normal">
                  Pista .MP4 optimizada para WhatsApp con fondo animado, ondas y letras
                </span>
              </button>
            </div>

            {/* Action button to trigger queue render of all active custom assets into a single package */}
            <button
              id="btn-download-batch"
              onClick={() => handleBatchProduceAll("video")}
              disabled={isRecording || batchState.isActive || !scriptText.trim()}
              type="button"
              className="mt-4 w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-neutral-900 to-neutral-950 hover:from-neutral-850 hover:to-neutral-900 text-neutral-200 hover:text-emerald-400 font-sans font-bold border border-neutral-800 hover:border-emerald-500/30 rounded-xl transition-all shadow-md group scale-100 hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-45 disabled:hover:text-neutral-200 disabled:scale-100 disabled:cursor-not-allowed"
            >
              <div className="p-2 bg-neutral-950 rounded-lg text-emerald-400 group-hover:scale-105 transition-transform border border-neutral-800 shrink-0">
                <FolderSync className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-xs font-bold text-neutral-100 group-hover:text-emerald-400 transition-colors">
                  Generar Lote Completo (ZIP de Videos MP4)
                </span>
                <span className="text-[10px] text-neutral-400 font-normal mt-0.5 leading-normal">
                  Procesa de forma secuencial todas las piezas fotos/videos (máx 5) cargadas en tu Galería Personal y descarga un paquete .ZIP para WhatsApp.
                </span>
              </div>
            </button>
          </section>

          {/* Module 5: Productions History list */}
          <section className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-5 flex-1 flex flex-col" id="history-items-module">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-400" />
                <h3 className="font-sans font-semibold text-neutral-100 text-xs uppercase tracking-wider">
                  Historial de Producciones Generadas
                </h3>
              </div>
              
              {historyList.length > 0 && (
                <button
                  id="btn-clear-history"
                  onClick={() => {
                    setHistoryList([]);
                    showAlert("success", "Historial limpiado.");
                  }}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1 uppercase tracking-wider font-mono bg-transparent cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-neutral-600 bg-neutral-950/20 rounded-lg border border-neutral-900/50" id="empty-history-graphic">
                <VolumeX className="h-7 w-7 mb-2" />
                <p className="text-xs font-medium">Aún no has generado piezas multimedia</p>
                <p className="text-[10px] max-w-[220px] mt-1">
                  Configura tus osciladores y haz clic en los botones de descargar arriba para generar registros persistentes.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1" id="history-scroller">
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    id={`history-item-${item.id}`}
                    className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg hover:border-neutral-800 transition-colors flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${item.type === "video" ? "bg-emerald-400" : "bg-sky-400"}`}></span>
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-300">
                          {item.type === "video" ? "Video completo" : "Pista de audio"}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ({item.duration}s)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-neutral-600">
                        {item.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-450 line-clamp-2 leading-relaxed">
                      "{item.text}"
                    </p>

                    {item.imageUrl && (
                      <div className="h-10 w-full rounded overflow-hidden border border-neutral-900">
                        <img src={item.imageUrl} alt="preview" className="h-full w-full object-cover" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 border-t border-neutral-900 pt-2">
                      {item.type === "video" ? (
                        <video src={item.mediaUrl} controls className="w-full max-h-[170px] bg-neutral-950 rounded border border-neutral-850 overflow-hidden" playsInline webkit-playsinline="true" />
                      ) : (
                        <audio src={item.mediaUrl} controls className="h-8 w-full" />
                      )}
                      
                      <div className="flex justify-end mt-1.5">
                        <a
                          href={item.mediaUrl}
                          download={`produccion_${item.type}_${item.id}.${item.type === "video" ? "mp4" : "mp3"}`}
                          id={`btn-history-download-${item.id}`}
                          className="p-1 px-3 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white rounded text-[10px] font-semibold border border-neutral-800 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download className="h-3 w-3 text-emerald-400" /> Descargar {item.type === "video" ? "MP4" : "MP3"}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Humble Clean footer with system credits hidden to respect architectural honesty */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-4 px-6 text-center" id="app-footer">
        <p className="text-[10px] text-neutral-500 font-mono tracking-wider">
          ESTUDIO ULTRA-SÓNICO AUTOMATIZADO / PROCESO DE PRODUCCIÓN DE ALTÍSIMA DISCIPLINE
        </p>
      </footer>
    </div>
  );
}
