import { useQuery } from "@tanstack/react-query";
import { textQueryOptions } from "@/lib/query";
import MarkdownPreview from "@uiw/react-markdown-preview";

export default function MarkdownViewer({ path }: { path: string }) {
  const { data: content, isLoading, error } = useQuery(textQueryOptions(path));

  if (error) {
    return <div style={{ padding: 32, color: "var(--dropbox-red)", fontSize: 14 }}>{error.message}</div>;
  }

  if (isLoading || content === undefined) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 56px)" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--dropbox-blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: "var(--dropbox-white)" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "40px 32px 64px" }}>
        <MarkdownPreview
          source={content}
          style={{ background: "transparent", fontSize: 15, lineHeight: 1.7 }}
          wrapperElement={{ "data-color-mode": "light" } as any}
        />
      </article>
    </div>
  );
}
