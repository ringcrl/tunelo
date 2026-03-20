import { useCallback, useEffect, useRef, useState } from "react";
import { rawUrl } from "@/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowsOut, ArrowsIn, Minus, Plus } from "@phosphor-icons/react";

export default function ImageViewer({ path, name }: { path: string; name: string }) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 5)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.25)), []);
  const fitScreen = useCallback(() => setScale(1), []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale((s) => Math.min(Math.max(s - e.deltaY * 0.002, 0.25), 5));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const pct = Math.round(scale * 100);

  return (
    <div ref={wrapperRef} className="flex flex-col min-h-[calc(100vh-53px)] bg-[var(--dropbox-gray-100)]">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[var(--dropbox-gray-300)] px-4 py-2 flex items-center justify-center gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={zoomOut} />}>
            <Minus className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>

        <span className="text-xs text-[var(--dropbox-gray-500)] w-12 text-center tabular-nums font-medium">
          {pct}%
        </span>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={zoomIn} />}>
            <Plus className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Button variant="ghost" size="sm" onClick={fitScreen} className="text-xs text-[var(--dropbox-gray-500)]">
          Fit
        </Button>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} />}>
            {isFullscreen ? <ArrowsIn className="size-4" /> : <ArrowsOut className="size-4" />}
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Button variant="link" size="sm" render={<a href={rawUrl(path)} download />}>
          Download
        </Button>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <div
          className="bg-white rounded-xl shadow-lg p-2"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            transition: "transform 150ms cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <img
            ref={imgRef}
            src={rawUrl(path)}
            alt={name}
            className="max-w-[85vw] max-h-[80vh] object-contain rounded-lg"
            draggable={false}
          />
        </div>
      </div>

      {/* File name */}
      <div className="text-center py-3 text-sm text-[var(--dropbox-gray-500)]">{name}</div>
    </div>
  );
}
