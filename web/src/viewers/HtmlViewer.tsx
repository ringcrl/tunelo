import { lazy, Suspense, useState } from "react";
import { rawUrl } from "@/api";
import { Button } from "@/components/ui/button";
import { ArrowSquareOut } from "@phosphor-icons/react";

const CodeViewer = lazy(() => import("./CodeViewer"));

export default function HtmlViewer({ path, name }: { path: string; name: string }) {
  const [tab, setTab] = useState<"preview" | "source">("preview");

  return (
    <div className="h-[calc(100vh-53px)] flex flex-col">
      <div className="bg-white border-b border-[var(--dropbox-gray-300)] px-6 py-2 flex items-center gap-1">
        {(["preview", "source"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t === "preview" ? "🌐 Preview" : "</> Source"}
          </Button>
        ))}
        <Button variant="link" size="sm" className="ml-auto" render={<a href={rawUrl(path)} target="_blank" rel="noopener noreferrer" />}>
          Open in new tab
          <ArrowSquareOut className="size-3" />
        </Button>
      </div>

      {tab === "source" ? (
        <Suspense fallback={<div className="p-8 text-[var(--dropbox-gray-500)]">Loading…</div>}>
          <div className="flex-1">
            <CodeViewer path={path} name={name} />
          </div>
        </Suspense>
      ) : (
        <iframe
          src={rawUrl(path)}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title={name}
        />
      )}
    </div>
  );
}
