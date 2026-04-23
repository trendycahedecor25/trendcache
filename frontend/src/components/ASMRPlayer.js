import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2 } from 'lucide-react';

const SOUNDS = [
  { id: 'rain', label: 'Rainfall', color: '#4E9FE5', description: 'Gentle rain on a window' },
  { id: 'ocean', label: 'Ocean Waves', color: '#10B981', description: 'Soft waves on shore' },
  { id: 'fire', label: 'Crackling Fire', color: '#FF715B', description: 'Warm fireplace crackle' },
  { id: 'wind', label: 'Soft Wind', color: '#8B5CF6', description: 'Gentle breeze through trees' },
  { id: 'brown', label: 'Brown Noise', color: '#FFB627', description: 'Deep, warm static' },
];

// Generate ambient sounds purely with Web Audio API
function createSoundGenerator(audioCtx, type) {
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);

  if (type === 'brown') {
    // Brown noise: filtered random
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(masterGain);
    return { source, gain: masterGain };
  }

  if (type === 'rain') {
    // Rain: filtered white noise + occasional ticks
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
      // Add occasional louder "drops"
      if (Math.random() < 0.001) data[i] *= 3;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    source.connect(filter);
    filter.connect(masterGain);
    return { source, gain: masterGain };
  }

  if (type === 'ocean') {
    // Ocean: modulated low-pass noise
    const bufferSize = 4 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / audioCtx.sampleRate;
      const wave = Math.sin(t * 0.15 * Math.PI * 2) * 0.5 + 0.5;
      data[i] = (Math.random() * 2 - 1) * wave;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    source.connect(filter);
    filter.connect(masterGain);
    masterGain.gain.value = 0.5;
    return { source, gain: masterGain };
  }

  if (type === 'fire') {
    // Fire: crackle = burst noise
    const bufferSize = 3 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      let sample = Math.random() * 2 - 1;
      // Crackle bursts
      if (Math.random() < 0.003) {
        const burstLen = Math.floor(Math.random() * 200 + 50);
        for (let j = 0; j < burstLen && i + j < bufferSize; j++) {
          data[i + j] = (Math.random() * 2 - 1) * (1 - j / burstLen) * 2;
        }
        i += 100;
      } else {
        data[i] = sample * 0.05;
      }
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 200;
    const filter2 = audioCtx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 4000;
    source.connect(filter);
    filter.connect(filter2);
    filter2.connect(masterGain);
    masterGain.gain.value = 0.6;
    return { source, gain: masterGain };
  }

  if (type === 'wind') {
    // Wind: very low-pass filtered noise with slow modulation
    const bufferSize = 4 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / audioCtx.sampleRate;
      const mod = Math.sin(t * 0.08 * Math.PI * 2) * 0.3 + 0.7;
      data[i] = (Math.random() * 2 - 1) * mod;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 1;
    source.connect(filter);
    filter.connect(masterGain);
    masterGain.gain.value = 0.4;
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
                      <div key={i} className="w-1 rounded-full animate-pulse" style={{
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
