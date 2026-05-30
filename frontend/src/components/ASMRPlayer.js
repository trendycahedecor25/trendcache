import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2 } from 'lucide-react';

const SOUNDS = [
  { id: 'creek_birdsong', label: 'Creek & Birdsong', color: '#4E9FE5', description: 'Babbling creek with gentle birdsong', src: '/asmr/creek_birdsong.mp3' },
  { id: 'babbling_brook', label: 'Babbling Brook', color: '#10B981', description: 'Soft water over smooth stones', src: '/asmr/babbling_brook.mp3' },
  { id: 'flowing_stream', label: 'Flowing Stream', color: '#8B5CF6', description: 'Steady creek flow with light splashing', src: '/asmr/flowing_stream.mp3' },
  { id: 'gentle_trickle', label: 'Gentle Trickle', color: '#FFB627', description: 'Quiet, peaceful water trickle', src: '/asmr/gentle_trickle.mp3' },
  { id: 'creek_ambiance', label: 'Creek Ambiance', color: '#FF715B', description: 'Immersive creek soundscape', src: '/asmr/creek_ambiance.mp3' },
];

export default function ASMRPlayer({ onClose }) {
  const [activeSound, setActiveSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const audioRef = useRef(null);

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const playSound = useCallback((soundId) => {
    const sound = SOUNDS.find(s => s.id === soundId);
    if (!sound) return;

    // If switching sounds, create new audio element
    if (!audioRef.current || audioRef.current.dataset.soundId !== soundId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      const audio = new Audio(sound.src);
      audio.loop = true;
      audio.volume = volume / 100;
      audio.dataset.soundId = soundId;
      audioRef.current = audio;
    }

    audioRef.current.volume = volume / 100;
    audioRef.current.play().catch(() => {});
    setActiveSound(soundId);
    setPlaying(true);
  }, [volume]);

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
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    stopSound();
    setActiveSound(null);
    onClose();
  }, [stopSound, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="asmr-player-modal">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 relative">
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-slate-100" data-testid="close-asmr-player">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="font-['Outfit'] font-bold text-xl text-slate-900 mb-1">Nature Sounds</h3>
        <p className="text-sm text-slate-500 mb-6">Real creek recordings. Close your eyes. Just listen.</p>

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
