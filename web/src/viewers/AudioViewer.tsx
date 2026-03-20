import { rawUrl } from "@/api";
import { MusicNote } from "@phosphor-icons/react";

export default function AudioViewer({ path, name }: { path: string; name: string }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "AUDIO";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 56px)",
      background: "var(--dropbox-gray-50)",
      padding: 32,
      gap: 24,
    }}>
      <div style={{
        width: 120,
        height: 120,
        borderRadius: 24,
        background: "var(--dropbox-white)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <MusicNote size={48} weight="duotone" style={{ color: "#a855f7" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--dropbox-gray-900)" }}>{name}</div>
        <div style={{ fontSize: 13, color: "var(--dropbox-gray-500)", marginTop: 4 }}>{ext}</div>
      </div>
      <audio
        src={rawUrl(path)}
        controls
        autoPlay
        style={{ width: "100%", maxWidth: 400, outline: "none" }}
      />
    </div>
  );
}
