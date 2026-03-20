import { detectViewer } from "@/types";
import { rawUrl } from "@/api";
import { DownloadSimple, File } from "@phosphor-icons/react";
import HtmlViewer from "./HtmlViewer";
import ImageViewer from "./ImageViewer";
import VideoViewer from "./VideoViewer";
import AudioViewer from "./AudioViewer";
import PdfViewer from "./PdfViewer";
import MarkdownViewer from "./MarkdownViewer";
import CodeViewer from "./CodeViewer";
import CsvViewer from "./CsvViewer";
import ExcelViewer from "./ExcelViewer";

interface Props {
  path: string;
  name: string;
}

export default function FileViewer({ path, name }: Props) {
  const kind = detectViewer(name, false);

  switch (kind) {
    case "html":      return <HtmlViewer path={path} name={name} />;
    case "image":     return <ImageViewer path={path} name={name} />;
    case "video":     return <VideoViewer path={path} />;
    case "audio":     return <AudioViewer path={path} name={name} />;
    case "pdf":       return <PdfViewer path={path} />;
    case "markdown":  return <MarkdownViewer path={path} />;
    case "csv":       return <CsvViewer path={path} />;
    case "excel":     return <ExcelViewer path={path} />;
    case "code":
    case "text":      return <CodeViewer path={path} name={name} />;
    default:
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 56px)",
          background: "var(--dropbox-gray-50)",
          gap: 20,
          padding: 32,
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "var(--dropbox-white)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <File size={36} weight="duotone" style={{ color: "var(--dropbox-gray-500)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--dropbox-gray-900)" }}>{name}</div>
            <div style={{ fontSize: 13, color: "var(--dropbox-gray-500)", marginTop: 4 }}>No preview available</div>
          </div>
          <a
            href={rawUrl(path)}
            download
            className="btn-primary"
          >
            <DownloadSimple size={16} weight="bold" />
            Download
          </a>
        </div>
      );
  }
}
