import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  DownloadSimple,
  FileCode,
  FileText,
  FilePdf,
  FileImage,
  FileVideo,
  FileAudio,
  FileCsv,
  FileHtml,
  File,
} from "@phosphor-icons/react";
import { rawUrl } from "@/api";
import { detectViewer } from "@/types";
import FileViewer from "@/viewers/FileViewer";

export default function Viewer() {
  const { path } = useSearch({ from: "/view" });
  const navigate = useNavigate();
  const fileName = path.split("/").pop() ?? path;
  const parentDir = path.substring(0, path.lastIndexOf("/") + 1) || "/";
  const Icon = getFileIcon(fileName);

  return (
    <div className="min-h-screen view-enter" style={{ background: "var(--dropbox-gray-50)" }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          height: 56,
          background: "var(--dropbox-white)",
          borderBottom: "1px solid var(--dropbox-gray-200)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Back */}
        <button
          onClick={() => navigate({ to: "/", search: { path: parentDir } })}
          className="btn-ghost"
          style={{ padding: "8px 12px" }}
        >
          <ArrowLeft size={18} weight="bold" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* File name — centered */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minWidth: 0,
            padding: "0 12px",
          }}
        >
          <Icon size={18} weight="duotone" style={{ color: "var(--dropbox-gray-500)", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--dropbox-gray-900)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </span>
        </div>

        {/* Download */}
        <a href={rawUrl(path)} download className="btn-primary" style={{ padding: "8px 16px" }}>
          <DownloadSimple size={16} weight="bold" />
          <span className="hidden sm:inline">Download</span>
        </a>
      </header>

      {/* ── Preview ─────────────────────────────────────── */}
      <div style={{ background: "var(--dropbox-white)" }}>
        <FileViewer path={path} name={fileName} />
      </div>
    </div>
  );
}

function getFileIcon(name: string) {
  const kind = detectViewer(name, false);
  switch (kind) {
    case "code": return FileCode;
    case "markdown":
    case "text": return FileText;
    case "pdf": return FilePdf;
    case "image": return FileImage;
    case "video": return FileVideo;
    case "audio": return FileAudio;
    case "csv":
    case "excel": return FileCsv;
    case "html": return FileHtml;
    default: return File;
  }
}
