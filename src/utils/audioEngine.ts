/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackgroundNoiseType } from "../types";

export interface CustomAudioGraph {
  ctx: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  voiceGain: GainNode;
  bassOsc: OscillatorNode | null;
  bassGain: GainNode | null;
  noiseNode: AudioNode | null;
  noiseGain: GainNode;
  masterGain: GainNode;
  activeNodes: { stop: () => void }[];
}

/**
 * Procedural audio generators using the Web Audio API.
 * This guarantees zero external dependencies and 100% real-time, high-fidelity sound.
 */

// Generate White Noise Buffer
function getWhiteNoiseBuffer(ctx: AudioContext, secs = 30): AudioBuffer {
  const bufferSize = ctx.sampleRate * secs;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Generate Pink-ish/Brown-ish Noise for softer rain/rumble
function getBrownNoiseBuffer(ctx: AudioContext, secs = 30): AudioBuffer {
  const bufferSize = ctx.sampleRate * secs;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Brown noise filter formula
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // Gain compensation
  }
  return buffer;
}

/**
 * Creates procedural noises
 */
export function createRainNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  // Rain is a combination of filtered pink/brown noise and rapid cracking transients
  const noise = ctx.createBufferSource();
  noise.buffer = getBrownNoiseBuffer(ctx, 30);
  noise.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1000, ctx.currentTime);
  bandpass.Q.setValueAtTime(1.5, ctx.currentTime);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(3000, ctx.currentTime);

  noise.connect(bandpass);
  bandpass.connect(lowpass);

  // Add random rain drop patters using an envelope-controlled periodic click oscillator
  const dropOsc = ctx.createOscillator();
  dropOsc.type = "sine";
  dropOsc.frequency.setValueAtTime(150, ctx.currentTime);

  const dropGain = ctx.createGain();
  dropGain.gain.setValueAtTime(0, ctx.currentTime);

  // Use a script/intervals or an LFO to modulate rain crackle volume
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(8, ctx.currentTime); // 8 Hz flutter
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.15, ctx.currentTime);

  lfo.connect(lfoGain);
  lfoGain.connect(dropGain.gain);

  dropOsc.connect(dropGain);

  const mixer = ctx.createGain();
  lowpass.connect(mixer);
  dropGain.connect(mixer);

  noise.start();
  dropOsc.start();
  lfo.start();

  return {
    node: mixer,
    stop: () => {
      try {
        noise.stop();
        dropOsc.stop();
        lfo.stop();
      } catch (e) {}
    },
  };
}

export function createSpaceDroneNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  // Epic deep-space synthesizer hum
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(55, ctx.currentTime); // Sub octave

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(110.5, ctx.currentTime); // detuned octave

  const osc3 = ctx.createOscillator();
  osc3.type = "triangle";
  osc3.frequency.setValueAtTime(165, ctx.currentTime); // fifth overtone

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(120, ctx.currentTime);
  filter.Q.setValueAtTime(5, ctx.currentTime);

  // LFO to slowly modulate filter frequency (gives space cabin feel)
  const filterLfo = ctx.createOscillator();
  filterLfo.frequency.setValueAtTime(0.2, ctx.currentTime); // very slow
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.setValueAtTime(40, ctx.currentTime); // +/- 40Hz

  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(filter.frequency);

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.4, ctx.currentTime);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.5, ctx.currentTime);
  const gain3 = ctx.createGain();
  gain3.gain.setValueAtTime(0.2, ctx.currentTime);

  osc1.connect(gain1);
  osc2.connect(gain2);
  osc3.connect(gain3);

  const oscMixer = ctx.createGain();
  gain1.connect(oscMixer);
  gain2.connect(oscMixer);
  gain3.connect(oscMixer);

  oscMixer.connect(filter);

  osc1.start();
  osc2.start();
  osc3.start();
  filterLfo.start();

  return {
    node: filter,
    stop: () => {
      try {
        osc1.stop();
        osc2.stop();
        osc3.stop();
        filterLfo.stop();
      } catch (e) {}
    },
  };
}

export function createCafeteriaNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  // Simulated warm social murmur + glasses clicking
  const rumble = ctx.createBufferSource();
  rumble.buffer = getBrownNoiseBuffer(ctx, 30);
  rumble.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(300, ctx.currentTime);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.5, ctx.currentTime);
  rumble.connect(lowpass).connect(rumbleGain);

  // Random clicks simulating cups
  const clickOsc = ctx.createOscillator();
  clickOsc.type = "sine";
  clickOsc.frequency.setValueAtTime(2200, ctx.currentTime);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0, ctx.currentTime);

  // Random intervals for cup clinking
  let active = true;
  const triggerClick = () => {
    if (!active) return;
    const now = ctx.currentTime;
    clickOsc.frequency.setValueAtTime(1500 + Math.random() * 2000, now);
    clickGain.gain.cancelScheduledValues(now);
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.linearRampToValueAtTime(0.08 * (Math.random() * 0.5 + 0.5), now + 0.005);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    setTimeout(triggerClick, 500 + Math.random() * 2500);
  };
  triggerClick();

  clickOsc.connect(clickGain);

  const mixer = ctx.createGain();
  rumbleGain.connect(mixer);
  clickGain.connect(mixer);

  rumble.start();
  clickOsc.start();

  return {
    node: mixer,
    stop: () => {
      active = false;
      try {
        rumble.stop();
        clickOsc.stop();
      } catch (e) {}
    },
  };
}

export function createOfficeNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  // AC Hum + Keyboard clicks simulation
  const hum = ctx.createOscillator();
  hum.type = "sine";
  hum.frequency.setValueAtTime(50, ctx.currentTime); // AC hum (50Hz grid)

  const humGain = ctx.createGain();
  humGain.gain.setValueAtTime(0.15, ctx.currentTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(80, ctx.currentTime);
  hum.connect(filter).connect(humGain);

  // Click simulator (keyboard typewriters)
  const bBuffer = getWhiteNoiseBuffer(ctx, 3);
  const clickSource = ctx.createBufferSource();
  clickSource.buffer = bBuffer;
  clickSource.loop = true;

  const bFilter = ctx.createBiquadFilter();
  bFilter.type = "bandpass";
  bFilter.frequency.setValueAtTime(3200, ctx.currentTime);
  bFilter.Q.setValueAtTime(8, ctx.currentTime);

  const bGain = ctx.createGain();
  bGain.gain.setValueAtTime(0, ctx.currentTime);

  clickSource.connect(bFilter).connect(bGain);

  let active = true;
  const triggerKeyboard = () => {
    if (!active) return;
    const now = ctx.currentTime;
    bGain.gain.cancelScheduledValues(now);
    bGain.gain.setValueAtTime(0, now);
    bGain.gain.linearRampToValueAtTime(0.06 * (Math.random() * 0.4 + 0.6), now + 0.002);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    const delay = 80 + Math.random() * 400; // fast typing speed
    setTimeout(triggerKeyboard, delay);
  };
  triggerKeyboard();

  const mixer = ctx.createGain();
  humGain.connect(mixer);
  bGain.connect(mixer);

  hum.start();
  clickSource.start();

  return {
    node: mixer,
    stop: () => {
      active = false;
      try {
        hum.stop();
        clickSource.stop();
      } catch (e) {}
    },
  };
}

export function createNatureNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  // Wind rustling + Bird chirping FM synthesis!
  const wind = ctx.createBufferSource();
  wind.buffer = getBrownNoiseBuffer(ctx, 30);
  wind.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.setValueAtTime(250, ctx.currentTime);
  windFilter.Q.setValueAtTime(1.0, ctx.currentTime);

  // LFO modulates wind frequency back and forth
  const windLfo = ctx.createOscillator();
  windLfo.frequency.setValueAtTime(0.12, ctx.currentTime);
  const windLfoGain = ctx.createGain();
  windLfoGain.gain.setValueAtTime(150, ctx.currentTime);

  windLfo.connect(windLfoGain);
  windLfoGain.connect(windFilter.frequency);

  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.6, ctx.currentTime);
  wind.connect(windFilter).connect(windGain);

  // Bird synthesizer using FM synthesis: Modulator modulates Carrier frequency
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(2400, ctx.currentTime);

  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.setValueAtTime(45, ctx.currentTime);

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(400, ctx.currentTime);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const birdGain = ctx.createGain();
  birdGain.gain.setValueAtTime(0, ctx.currentTime);
  carrier.connect(birdGain);

  let active = true;
  const triggerBird = () => {
    if (!active) return;
    const now = ctx.currentTime;
    const duration = 0.2 + Math.random() * 0.4;
    
    // Set chirping freq curves
    carrier.frequency.setValueAtTime(2000 + Math.random() * 1000, now);
    modulator.frequency.setValueAtTime(30 + Math.random() * 50, now);
    modGain.gain.setValueAtTime(300 + Math.random() * 300, now);

    birdGain.gain.cancelScheduledValues(now);
    birdGain.gain.setValueAtTime(0, now);
    birdGain.gain.linearRampToValueAtTime(0.04 * (Math.random() * 0.5 + 0.5), now + 0.05);
    birdGain.gain.linearRampToValueAtTime(0.04, now + duration - 0.05);
    birdGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // bird chirp intervals
    setTimeout(triggerBird, 3000 + Math.random() * 6000);
  };
  
  setTimeout(triggerBird, 1500);

  const mixer = ctx.createGain();
  windGain.connect(mixer);
  birdGain.connect(mixer);

  wind.start();
  windLfo.start();
  carrier.start();
  modulator.start();

  return {
    node: mixer,
    stop: () => {
      active = false;
      try {
        wind.stop();
        windLfo.stop();
        carrier.stop();
        modulator.stop();
      } catch (e) {}
    },
  };
}

export function createWhiteNoiseNode(ctx: AudioContext): { node: AudioNode; stop: () => void } {
  const noise = ctx.createBufferSource();
  noise.buffer = getWhiteNoiseBuffer(ctx, 30);
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(8000, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);

  noise.connect(filter).connect(gain);
  noise.start();

  return {
    node: gain,
    stop: () => {
      try {
        noise.stop();
      } catch (e) {}
    },
  };
}

/**
 * Creates the entire composite audio pipeline
 */
export function buildAudioSystem(noiseType: BackgroundNoiseType, noiseVol: number): CustomAudioGraph {
  // Check for window.AudioContext compatibility
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  
  if (ctx.state === "suspended") {
    ctx.resume().catch(e => console.warn("Failed automatic context resumption in buildAudioSystem:", e));
  }
  
  const destination = ctx.createMediaStreamDestination();
  
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
  masterGain.connect(destination);
  masterGain.connect(ctx.destination); // Also send to default output for audibility!

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(1.0, ctx.currentTime);
  voiceGain.connect(masterGain);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(noiseVol, ctx.currentTime);
  noiseGain.connect(masterGain);

  const activeNodes: { stop: () => void }[] = [];
  let noiseNode: AudioNode | null = null;

  if (noiseType !== "none" && noiseVol > 0) {
    let synth: { node: AudioNode; stop: () => void };
    switch (noiseType) {
      case "rain":
        synth = createRainNode(ctx);
        break;
      case "drone_espacial":
        synth = createSpaceDroneNode(ctx);
        break;
      case "cafeteria":
        synth = createCafeteriaNode(ctx);
        break;
      case "oficina":
        synth = createOfficeNode(ctx);
        break;
      case "naturaleza":
        synth = createNatureNode(ctx);
        break;
      case "ruido_blanco":
        synth = createWhiteNoiseNode(ctx);
        break;
      default:
        synth = createWhiteNoiseNode(ctx);
        break;
    }
    noiseNode = synth.node;
    noiseNode.connect(noiseGain);
    activeNodes.push(synth);
  }

  return {
    ctx,
    destination,
    voiceGain,
    bassOsc: null,
    bassGain: null,
    noiseNode,
    noiseGain,
    masterGain,
    activeNodes,
  };
}

/**
 * Spawns a rhythmic sub-bass rumble modulated with human speech
 * to give that luxury studio voice compressor/limiter thickness.
 */
export function addSubBassSynthesizer(graph: CustomAudioGraph, intensity = 0.6) {
  const { ctx, voiceGain, masterGain } = graph;

  // We create a synth envelope linked to the voice channel
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(52, ctx.currentTime); // 52 Hz (G#0 / A0 range) deep bass sub-rumble

  const bGain = ctx.createGain();
  bGain.gain.setValueAtTime(0, ctx.currentTime);

  osc.connect(bGain);
  bGain.connect(masterGain);

  osc.start();

  // Create a follower/analyzer to track vocal amplitude and map it to sub-bass
  // This procedurally ensures the sub-bass is ONLY active when the voice speaks!
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  voiceGain.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  let active = true;
  const updateEnvelopes = () => {
    if (!active) return;
    analyser.getByteFrequencyData(dataArray);
    
    // Average amplitude across voice range
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const avg = sum / bufferLength; // 0 to 255
    const normalized = Math.min(avg / 45, 1.0); // normalize speech envelope output

    // Scale dynamically by the requested intensity
    const targetBassGain = normalized * 0.45 * intensity;

    bGain.gain.setTargetAtTime(targetBassGain, ctx.currentTime, 0.05);

    requestAnimationFrame(updateEnvelopes);
  };

  updateEnvelopes();

  graph.bassOsc = osc;
  graph.bassGain = bGain;
  graph.activeNodes.push({
    stop: () => {
      active = false;
      try {
        osc.stop();
      } catch (e) {}
    },
  });
}
