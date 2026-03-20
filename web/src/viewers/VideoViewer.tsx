import { rawUrl } from "@/api";

export default function VideoViewer({ path }: { path: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 56px)",
      background: "var(--dropbox-gray-50)",
      padding: 24,
    }}>
      <video
        src={rawUrl(path)}
        controls
        autoPlay
        playsInline
        style={{
          maxWidth: "100%",
          maxHeight: "calc(100vh - 104px)",
          borderRadius: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          outline: "none",
          background: "#000",
        }}
      />
    </div>
  );
}
