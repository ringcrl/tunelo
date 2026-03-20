import { rawUrl } from "@/api";

export default function VideoViewer({ path }: { path: string }) {
  return (
    <div className="flex items-center justify-center bg-[#0a0a0a] min-h-[calc(100vh-53px)] p-6 content-reveal">
      <video
        src={rawUrl(path)}
        controls
        autoPlay
        playsInline
        className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
        style={{ outline: "none" }}
      />
    </div>
  );
}
