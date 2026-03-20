import { rawUrl } from "@/api";

export default function ImageViewer({ path, name }: { path: string; name: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 56px)",
      background: "var(--dropbox-gray-50)",
      padding: 24,
    }}>
      <img
        src={rawUrl(path)}
        alt={name}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "calc(100vh - 104px)",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      />
    </div>
  );
}
