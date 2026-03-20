import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { arrayBufferQueryOptions } from "@/lib/query";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function PdfViewer({ path }: { path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const [numPages, setNumPages] = useState(0);
  const scale = 1.5;

  const { data: pdfData, error } = useQuery(arrayBufferQueryOptions(path));

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
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 16px";
        canvas.style.borderRadius = "4px";
        canvas.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas } as any).promise;
      }
    })();

    return () => { cancelled = true; };
  }, [numPages]);

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--dropbox-red)", fontSize: 14 }}>
        Failed to load PDF: {error.message}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "calc(100vh - 56px)",
      background: "var(--dropbox-gray-100)",
      overflow: "auto",
      padding: "24px 16px",
    }}>
      {numPages === 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <div style={{
            width: 24, height: 24,
            border: "2px solid var(--dropbox-blue)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      )}
      <div ref={containerRef} style={{ maxWidth: 900, margin: "0 auto" }} />
      {numPages > 0 && (
        <div style={{ textAlign: "center", padding: "8px 0 16px", fontSize: 12, color: "var(--dropbox-gray-500)" }}>
          {numPages} page{numPages > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
