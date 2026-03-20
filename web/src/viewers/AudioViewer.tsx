import { useCallback, useEffect, useRef, useState } from "react";
import { rawUrl } from "@/api";
import { Button } from "@/components/ui/button";

export default function AudioViewer({ path, name }: { path: string; name: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [seeking, setSeeking] = useState(false);

  const ext = name.split(".").pop()?.toUpperCase() ?? "AUDIO";

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;

    const onTime = () => { if (!seeking) setCurrent(a.currentTime); };
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setCurrent(0); };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, [seeking]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
  }, [playing]);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrent(parseFloat(e.target.value));
  }, []);

  const seekCommit = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = parseFloat(e.target.value);
    setSeeking(false);
  }, []);

  const changeVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-[calc(100vh-53px)] bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex flex-col items-center justify-center px-6 content-reveal">
      <audio ref={audioRef} src={rawUrl(path)} preload="metadata" />

      {/* Album art placeholder */}
      <div className="w-56 h-56 rounded-2xl bg-gradient-to-br from-[#e94560] to-[#533483] shadow-2xl flex items-center justify-center mb-10">
        <span className="text-8xl drop-shadow-lg">🎵</span>
      </div>

      {/* Track info */}
      <div className="text-center mb-8">
        <h2 className="text-white text-xl font-bold tracking-tight">{name}</h2>
        <p className="text-white/50 text-sm mt-1">{ext} • tunelo</p>
      </div>

      {/* Seek bar */}
      <div className="w-full max-w-md mb-6">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onMouseDown={() => setSeeking(true)}
          onTouchStart={() => setSeeking(true)}
          onChange={seek}
          onMouseUp={seekCommit as any}
          onTouchEnd={seekCommit as any}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #1db954 ${pct}%, rgba(255,255,255,0.2) ${pct}%)`,
          }}
        />
        <div className="flex justify-between mt-1.5 text-xs text-white/50 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-8 mb-10">
        {/* Skip back 10s */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10); }}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.5 3C17.15 3 21.08 6.03 22.45 10.22L20.08 11C18.96 7.59 15.99 5 12.5 5C10.54 5 8.77 5.78 7.44 7.04L10 9.5H3V2.5L5.72 5.22C7.42 3.84 9.87 3 12.5 3ZM7 13H5V11H7V13ZM12 19.94C9.04 19.94 6.56 18.22 5.37 15.73L7.53 14.85C8.39 16.69 10.22 17.94 12 17.94C13.78 17.94 15.61 16.69 16.47 14.85L18.63 15.73C17.44 18.22 14.96 19.94 12 19.94Z" />
          </svg>
        </Button>

        {/* Play/Pause */}
        <button
          onClick={toggle}
          className="w-14 h-14 rounded-full bg-white flex items-center justify-center hoverable-scale shadow-lg"
        >
          {playing ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a1a2e">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1a1a2e">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        {/* Skip forward 10s */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10); }}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5 3C6.85 3 2.92 6.03 1.55 10.22L3.92 11C5.04 7.59 8.01 5 11.5 5C13.46 5 15.23 5.78 16.56 7.04L14 9.5H21V2.5L18.28 5.22C16.58 3.84 14.13 3 11.5 3ZM17 13H19V11H17V13ZM12 19.94C14.96 19.94 17.44 18.22 18.63 15.73L16.47 14.85C15.61 16.69 13.78 17.94 12 17.94C10.22 17.94 8.39 16.69 7.53 14.85L5.37 15.73C6.56 18.22 9.04 19.94 12 19.94Z" />
          </svg>
        </Button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
          {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
        </svg>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={changeVolume}
          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #1db954 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}

function fmt(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
