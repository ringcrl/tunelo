import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rawUrl } from "@/api";
import { textQueryOptions } from "@/lib/query";
import { extToMonacoLang } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { init } from "modern-monaco";

export default function CodeViewer({ path, name }: { path: string; name: string }) {
  const lang = extToMonacoLang(name);
  const { data: content, isLoading: textLoading, error } = useQuery(textQueryOptions(path));
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
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
          });
          setEditorLoading(false);
        } catch (err: any) {
          if (!disposed) setEditorLoading(false);
        }
      })();

      return () => {
        disposed = true;
        editor?.dispose();
      };
    },
    [content, lang],
  );

  if (error) {
    return <div className="p-8 text-[var(--dropbox-red)] text-sm">Error: {error.message}</div>;
  }

  if (textLoading || content === undefined) {
    return (
      <div className="h-[calc(100vh-53px)] flex flex-col">
        <div className="bg-white border-b border-[var(--dropbox-gray-300)] px-6 py-2 flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--dropbox-blue)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-53px)] flex flex-col content-reveal">
      <div className="bg-white border-b border-[var(--dropbox-gray-300)] px-6 py-2 flex items-center justify-between">
        <Badge variant="secondary" className="uppercase tracking-wider text-xs">
          {lang}
        </Badge>
        <Button variant="link" size="sm" render={<a href={rawUrl(path)} download />}>
          Download raw
        </Button>
      </div>
      <div className="flex-1 relative">
        {editorLoading && (
          <div className="absolute inset-0 z-10 bg-white flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[var(--dropbox-blue)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
