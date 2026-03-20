import { rawUrl } from "@/api";

export default function HtmlViewer({ path }: { path: string; name: string }) {
  return (
    <div style={{ height: "calc(100vh - 56px)" }}>
      <iframe
        src={rawUrl(path)}
        title="HTML Preview"
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "var(--dropbox-white)",
        }}
      />
    </div>
  );
}
