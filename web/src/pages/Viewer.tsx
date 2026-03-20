import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react";
import { rawUrl } from "@/api";
import FileViewer from "@/viewers/FileViewer";

export default function Viewer() {
  const { path } = useSearch({ from: "/view" });
  const navigate = useNavigate();
  const fileName = path.split("/").pop() ?? path;
  const parentDir = path.substring(0, path.lastIndexOf("/") + 1) || "/";

  return (
    <div className="min-h-screen view-enter" style={{ background: "var(--dropbox-white)" }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px 0 8px",
        height: 56,
        borderBottom: "1px solid var(--dropbox-gray-200)",
        background: "var(--dropbox-white)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <button
          className="btn-ghost"
          onClick={() => navigate({ to: "/", search: { path: parentDir } })}
        >
          <ArrowLeft size={18} weight="bold" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div style={{ width: 1, height: 24, background: "var(--dropbox-gray-200)", flexShrink: 0 }} />

        <span style={{
          fontSize: 15,
          fontWeight: 500,
          color: "var(--dropbox-gray-900)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          padding: "0 4px",
        }}>
          {fileName}
        </span>

        <a href={rawUrl(path)} download className="btn-primary">
          <DownloadSimple size={16} weight="bold" />
          <span className="hidden sm:inline">Download</span>
        </a>
      </header>

      {/* ── Preview ─────────────────────────────────────── */}
      <FileViewer path={path} name={fileName} />
    </div>
  );
}
