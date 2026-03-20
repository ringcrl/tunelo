import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CaretLeft } from "@phosphor-icons/react";
import FileViewer from "@/viewers/FileViewer";

export default function Viewer() {
  const { path } = useSearch({ from: "/view" });
  const navigate = useNavigate();
  const fileName = path.split("/").pop() ?? path;
  const parentDir = path.substring(0, path.lastIndexOf("/") + 1) || "/";

  return (
    <div className="min-h-screen bg-[var(--dropbox-gray-50)] view-enter">
      <header className="bg-white border-b border-[var(--dropbox-gray-300)] px-6 py-3 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/", search: { path: parentDir } })}
          className="text-[var(--dropbox-blue)] hover:text-[var(--dropbox-blue-hover)]"
        >
          <CaretLeft className="size-4" weight="bold" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-[var(--dropbox-gray-900)] font-medium truncate">
          {fileName}
        </span>
      </header>
      <FileViewer path={path} name={fileName} />
    </div>
  );
}
