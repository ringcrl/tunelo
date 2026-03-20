import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { textQueryOptions } from "@/lib/query";
import { extToMonacoLang } from "@/types";
import { init } from "modern-monaco";

export default function CodeViewer({ path, name }: { path: string; name: string }) {
  const lang = extToMonacoLang(name);
  const { data: content, isLoading, error } = useQuery(textQueryOptions(path));
  const [editorLoading, setEditorLoading] = useState(true);

  const containerRef = useCallback<React.RefCallback<HTMLDivElement>>(
    (node) => {
      if (!node || content === undefined || content === null) return;

      let disposed = false;
      let editor: any = null;

      (async () => {
        try {
          const monaco = await init({ themes: ["github-light"] });
          if (disposed) return;

          editor = monaco.editor.create(node, {
            value: content,
            language: lang,
            theme: "github-light",
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: content.length > 5000 },
            fontSize: 13,
            lineNumbers: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            renderWhitespace: "selection",
            padding: { top: 16, bottom: 16 },
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          });
          setEditorLoading(false);
        } catch {
          if (!disposed) setEditorLoading(false);
        }
      })();

      return () => { disposed = true; editor?.dispose(); };
    },
    [content, lang],
  );

  if (error) {
    return <div style={{ padding: 32, color: "var(--dropbox-red)", fontSize: 14 }}>Error: {error.message}</div>;
  }

  if (isLoading || content === undefined) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 56px)" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--dropbox-blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 56px)", position: "relative" }}>
      {editorLoading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "var(--dropbox-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--dropbox-blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
