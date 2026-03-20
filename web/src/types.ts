export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
}

export type ViewerKind =
  | "dir" | "html" | "image" | "video" | "audio" | "pdf"
  | "markdown" | "code" | "csv" | "excel" | "text" | "unknown";

const IMAGE_EXT = new Set(["jpg","jpeg","png","gif","svg","webp","ico","bmp","avif","tiff"]);
const VIDEO_EXT = new Set(["mp4","webm","mov","avi","mkv","ogg","m4v"]);
const AUDIO_EXT = new Set(["mp3","wav","ogg","flac","aac","m4a","wma"]);
const CODE_EXT = new Set([
  "rs","go","py","js","ts","jsx","tsx","c","cpp","h","hpp","java","rb","php",
  "swift","kt","scala","sh","bash","zsh","lua","zig","vue","svelte","astro",
  "sql","graphql","proto","dockerfile","makefile","cmake","toml","yaml","yml",
  "json","xml","css","scss","sass","less","ini","cfg","conf","env",
  "gitignore","editorconfig",
]);

export function detectViewer(name: string, isDir: boolean): ViewerKind {
  if (isDir) return "dir";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (CODE_EXT.has(ext) || CODE_EXT.has(name.toLowerCase())) return "code";
  if (["txt","log","text","readme","license","changelog"].includes(ext) ||
      ["txt","log","text","readme","license","changelog"].includes(name.toLowerCase())) return "text";
  return "unknown";
}

export function extToMonacoLang(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    rs:"rust",go:"go",py:"python",js:"javascript",ts:"typescript",
    jsx:"javascript",tsx:"typescript",c:"c",cpp:"cpp",h:"c",hpp:"cpp",
    java:"java",rb:"ruby",php:"php",swift:"swift",kt:"kotlin",
    sh:"shell",bash:"shell",zsh:"shell",lua:"lua",sql:"sql",
    graphql:"graphql",html:"html",htm:"html",css:"css",scss:"scss",
    less:"less",json:"json",xml:"xml",yaml:"yaml",yml:"yaml",
    toml:"ini",dockerfile:"dockerfile",makefile:"shell",
    md:"markdown",markdown:"markdown",ini:"ini",cfg:"ini",conf:"ini",env:"shell",
  };
  return map[ext] ?? "plaintext";
}

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

// Dropbox-style colored file type icons using SVG
export function fileTypeColor(name: string, isDir: boolean): string {
  if (isDir) return "#F7BE00"; // Dropbox folder gold
  const kind = detectViewer(name, false);
  switch (kind) {
    case "image": return "#00B85C";
    case "video": return "#E5383B";
    case "audio": return "#A855F7";
    case "pdf": return "#D32F2F";
    case "markdown": return "#637282";
    case "code": return "#0061FE";
    case "csv": case "excel": return "#0D7D0D";
    case "html": return "#E44D26";
    default: return "#8C9BAA";
  }
}

export function fileIcon(name: string, isDir: boolean): string {
  if (isDir) return "📁";
  const kind = detectViewer(name, false);
  switch (kind) {
    case "html": return "🌐";
    case "image": return "🖼️";
    case "video": return "🎬";
    case "audio": return "🎵";
    case "pdf": return "📕";
    case "markdown": return "📝";
    case "code": return "💻";
    case "csv": case "excel": return "📊";
    case "text": return "📄";
    default: return "📄";
  }
}
