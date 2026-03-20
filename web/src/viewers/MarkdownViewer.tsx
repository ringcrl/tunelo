import { useQuery } from "@tanstack/react-query";
import { textQueryOptions } from "@/lib/query";
import MarkdownPreview from "@uiw/react-markdown-preview";

export default function MarkdownViewer({ path }: { path: string }) {
  const { data: content, isLoading, error } = useQuery(textQueryOptions(path));

  if (error) {
    return <div className="p-8 text-[var(--dropbox-red)] text-sm">{error.message}</div>;
  }

  if (isLoading || content === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-53px)]">
        <div className="w-5 h-5 border-2 border-[var(--dropbox-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-53px)] bg-[#FAFAF9]">
      <article className="tunelo-markdown max-w-3xl mx-auto px-10 py-12 content-reveal">
        <MarkdownPreview
          source={content}
          style={{ background: "transparent" }}
          wrapperElement={{ "data-color-mode": "light" } as any}
        />
      </article>
    </div>
  );
}
