import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2 } from 'lucide-react';

const SOUNDS = [
  { id: 'rain', label: 'Rainfall', color: '#4E9FE5', description: 'Gentle rain on a window' },
  { id: 'ocean', label: 'Ocean Waves', color: '#10B981', description: 'Soft waves on shore' },
  { id: 'fire', label: 'Crackling Fire', color: '#FF715B', description: 'Warm fireplace crackle' },
  { id: 'wind', label: 'Soft Wind', color: '#8B5CF6', description: 'Gentle breeze through trees' },
  { id: 'brown', label: 'Brown Noise', color: '#FFB627', description: 'Deep, warm static' },
];

function createSoundGenerator(audioCtx, type) {
  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  if (type === 'brown') {
    // Brown noise: gentle random walk, lower amplitude for warmth
    const bufferSize = 4 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * white) / 1.02;
        last = data[i];
        data[i] *= 2.8;
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Gentle lowpass to remove any harshness
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    source.connect(lp);
    lp.connect(masterGain);
    masterGain.gain.value = 0.3;
    return { source, gain: masterGain };
  }

  if (type === 'rain') {
    // Rain: layered broadband noise with gentle filtering for a wide, soft "shhhh"
    // plus subtle random amplitude variation to mimic intensity changes
    const bufferSize = 6 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        // Slow organic intensity variation (multiple overlapping sine waves)
        const mod = 0.6
          + 0.15 * Math.sin(t * 0.13 * Math.PI * 2)
          + 0.1 * Math.sin(t * 0.07 * Math.PI * 2 + 1.2)
          + 0.08 * Math.sin(t * 0.31 * Math.PI * 2 + 2.5);
        let sample = (Math.random() * 2 - 1) * mod;
        // Soft raindrop accents — gentle bumps, not harsh spikes
        if (Math.random() < 0.0008) {
          const dropLen = Math.floor(Math.random() * 80 + 20);
          for (let j = 0; j < dropLen && i + j < bufferSize; j++) {
            const env = Math.sin((j / dropLen) * Math.PI); // smooth bell curve
            data[i + j] += (Math.random() * 2 - 1) * env * 0.3;
          }
        }
        data[i] = sample;
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Pink-ish filter: gentle roll-off of highs, keep warmth
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3500;
    lp.Q.value = 0.3;
    // Remove rumble
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 150;
    hp.Q.value = 0.3;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(masterGain);
    masterGain.gain.value = 0.25;
    return { source, gain: masterGain };
  }

  if (type === 'ocean') {
    // Ocean: multiple overlapping wave cycles at different rates for organic feel
    // Each wave = noise shaped by a slow envelope
    const bufferSize = 8 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        // Three overlapping wave envelopes at different rates
        const wave1 = Math.pow(Math.sin(t * 0.1 * Math.PI * 2) * 0.5 + 0.5, 1.5);
        const wave2 = Math.pow(Math.sin(t * 0.067 * Math.PI * 2 + 1.8) * 0.5 + 0.5, 1.8) * 0.6;
        const wave3 = Math.pow(Math.sin(t * 0.04 * Math.PI * 2 + 3.1) * 0.5 + 0.5, 2.0) * 0.3;
        const envelope = wave1 + wave2 + wave3;
        // Gentle phase offset between L/R channels for width
        const offset = ch === 0 ? 0 : 0.003;
        const noise = Math.random() * 2 - 1;
        data[i] = noise * envelope * 0.35;
        // Add a subtle low rumble for the "whoosh" of the wave
        data[i] += Math.sin((t + offset) * 45 * Math.PI * 2) * envelope * 0.02;
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.2;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(masterGain);
    masterGain.gain.value = 0.4;
    return { source, gain: masterGain };
  }

  if (type === 'fire') {
    // Fire: warm base layer with soft, frequent micro-crackles
    const bufferSize = 6 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        // Warm, soft base rumble (like the body of a fire)
        const baseMod = 0.5 + 0.2 * Math.sin(t * 0.2 * Math.PI * 2) + 0.15 * Math.sin(t * 0.09 * Math.PI * 2 + 0.7);
        data[i] = (Math.random() * 2 - 1) * 0.12 * baseMod;

        // Frequent tiny crackles (gentle pops, not harsh)
        if (Math.random() < 0.002) {
          const crackleLen = Math.floor(Math.random() * 120 + 30);
          const crackleVol = Math.random() * 0.3 + 0.15;
          for (let j = 0; j < crackleLen && i + j < bufferSize; j++) {
            // Decaying envelope for natural pop
            const env = Math.exp(-j / (crackleLen * 0.25));
            data[i + j] += (Math.random() * 2 - 1) * env * crackleVol;
          }
        }
        // Occasional larger crackle (still gentle)
        if (Math.random() < 0.0003) {
          const bigLen = Math.floor(Math.random() * 300 + 100);
          for (let j = 0; j < bigLen && i + j < bufferSize; j++) {
            const env = Math.exp(-j / (bigLen * 0.2));
            data[i + j] += (Math.random() * 2 - 1) * env * 0.5;
          }
        }
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Warm filtering: cut harsh highs, keep mid warmth
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.Q.value = 0.3;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 100;
    hp.Q.value = 0.3;
    // Mid presence boost for warmth
    const mid = audioCtx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 600;
    mid.Q.value = 0.5;
    mid.gain.value = 3;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(mid);
    mid.connect(masterGain);
    masterGain.gain.value = 0.35;
    return { source, gain: masterGain };
  }

  if (type === 'wind') {
    // Wind: very slow, organic modulation with multiple overlapping layers
    const bufferSize = 8 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      const phaseOff = ch * 0.7; // stereo spread
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioCtx.sampleRate;
        // Multiple slow modulations for organic "gusting" feel
        const gust1 = Math.sin((t + phaseOff) * 0.05 * Math.PI * 2) * 0.3 + 0.5;
        const gust2 = Math.sin((t + phaseOff) * 0.12 * Math.PI * 2 + 2.1) * 0.2;
        const gust3 = Math.sin((t + phaseOff) * 0.025 * Math.PI * 2 + 4.3) * 0.15;
        const mod = Math.max(0.15, gust1 + gust2 + gust3);
        data[i] = (Math.random() * 2 - 1) * mod;
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Very gentle lowpass — wind is soft and low
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.2; // No resonance — smooth roll-off
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 40;
    source.connect(hp);
    hp.connect(lp);
    lp.connect(masterGain);
    masterGain.gain.value = 0.35;
    return { source, gain: masterGain };
  }

  return null;
}

export default function ASMRPlayer({ onClose }) {
  const [activeSound, setActiveSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const audioCtxRef = useRef(null);
  const generatorRef = useRef(null);

  const stopSound = useCallback(() => {
    try {
      if (generatorRef.current?.source) {
        generatorRef.current.source.stop();
      }
    } catch (e) { /* already stopped */ }
    generatorRef.current = null;
    setPlaying(false);
  }, []);

  const playSound = useCallback((soundId) => {
    stopSound();

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const gen = createSoundGenerator(ctx, soundId);
    if (gen) {
      gen.gain.gain.value = volume / 100 * 0.6;
      gen.source.start();
      generatorRef.current = gen;
      setActiveSound(soundId);
      setPlaying(true);
    }
  }, [stopSound, volume]);

  const togglePlay = useCallback((soundId) => {
    if (activeSound === soundId && playing) {
      stopSound();
      setActiveSound(null);
    } else {
      playSound(soundId);
    }
  }, [activeSound, playing, stopSound, playSound]);

  // Volume control
  useEffect(() => {
    if (generatorRef.current?.gain) {
      generatorRef.current.gain.gain.value = volume / 100 * 0.6;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSound();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stopSound]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="asmr-player-modal">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 relative">
        <button onClick={() => { stopSound(); onClose(); }} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100" data-testid="close-asmr-player">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="font-['Outfit'] font-bold text-xl text-slate-900 mb-1">ASMR Moment</h3>
        <p className="text-sm text-slate-500 mb-6">Pick a sound. Close your eyes. Just listen.</p>

        <div className="space-y-3 mb-6">
          {SOUNDS.map((sound) => {
            const isActive = activeSound === sound.id && playing;
            return (
              <button
                key={sound.id}
                onClick={() => togglePlay(sound.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'border-transparent shadow-md'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
                style={isActive ? { backgroundColor: `${sound.color}10`, borderColor: `${sound.color}40` } : {}}
                data-testid={`asmr-sound-${sound.id}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${sound.color}15` }}>
                  {isActive ? (
                    <Pause className="w-5 h-5" style={{ color: sound.color }} />
                  ) : (
                    <Play className="w-5 h-5" style={{ color: sound.color }} />
                  )}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-slate-900">{sound.label}</p>
                  <p className="text-xs text-slate-500">{sound.description}</p>
                </div>
                {isActive && (
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => (
                      <div key={`bar-${i}`} className="w-1 rounded-full animate-pulse" style={{
                        backgroundColor: sound.color,
                        height: `${10 + Math.random() * 14}px`,
                        animationDelay: `${i * 0.15}s`
                      }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-3 px-2">
          <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-slate-200 accent-[#FFB627]"
            data-testid="asmr-volume-slider"
          />
        </div>
      </div>
    </div>
  );
}
