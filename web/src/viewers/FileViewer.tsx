import { detectViewer } from "@/types";
import { rawUrl } from "@/api";
import { Button } from "@/components/ui/button";
import { DownloadSimple } from "@phosphor-icons/react";
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
        <div className="flex flex-col items-center justify-center py-24 gap-5 content-reveal">
          <div className="w-20 h-20 rounded-2xl bg-[var(--dropbox-gray-100)] flex items-center justify-center">
            <span className="text-4xl">📄</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--dropbox-gray-900)]">{name}</p>
            <p className="text-xs text-[var(--dropbox-gray-500)] mt-1">No preview available</p>
          </div>
          <Button render={<a href={rawUrl(path)} download />}>
            <DownloadSimple className="size-4" />
            Download
          </Button>
        </div>
      );
  }
}
