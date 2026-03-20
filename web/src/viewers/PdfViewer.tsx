import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { arrayBufferQueryOptions } from "@/lib/query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowsOut, ArrowsIn, Minus, Plus } from "@phosphor-icons/react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewer({ path }: { path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: pdfData, error } = useQuery(arrayBufferQueryOptions(path));

  // Load PDF document once data is available
  useEffect(() => {
    if (!pdfData) return;
    let cancelled = false;
    pdfjsLib.getDocument({ data: pdfData }).promise.then((pdf) => {
      if (cancelled) return;
      pdfRef.current = pdf;
      setNumPages(pdf.numPages);
    });
    return () => { cancelled = true; };
  }, [pdfData]);

  // Render pages when scale changes
  useEffect(() => {
    if (!pdfRef.current || !containerRef.current) return;
    let cancelled = false;
    const pdf = pdfRef.current;
    const container = containerRef.current;
    container.innerHTML = "";
    const dpr = window.devicePixelRatio || 1;

    (async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        const cssViewport = page.getViewport({ scale });
        const renderViewport = page.getViewport({ scale: scale * dpr });

        const canvas = document.createElement("canvas");
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;
        canvas.className = "shadow-md rounded-lg mb-4 mx-auto block";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;
      }
    })();

    return () => { cancelled = true; };
  }, [scale, numPages]);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 4)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.5)), []);
  const fitWidth = useCallback(() => setScale(1.5), []);

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

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--dropbox-red)] text-sm">
        Failed to load PDF: {error.message}
      </div>
    );
  }

  const pct = Math.round(scale * 100);

  return (
    <div ref={wrapperRef} className="bg-[var(--dropbox-gray-100)] min-h-[calc(100vh-53px)] flex flex-col">
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

        <Button variant="ghost" size="sm" onClick={fitWidth} className="text-xs text-[var(--dropbox-gray-500)]">
          Fit
        </Button>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={toggleFullscreen} />}>
            {isFullscreen ? <ArrowsIn className="size-4" /> : <ArrowsOut className="size-4" />}
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
        </Tooltip>

        {numPages > 0 && (
          <>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <span className="text-xs text-[var(--dropbox-gray-500)]">
              {numPages} page{numPages > 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-auto py-6">
        <div ref={containerRef} className="mx-auto px-4" style={{ maxWidth: "100%" }} />
      </div>
    </div>
  );
}
