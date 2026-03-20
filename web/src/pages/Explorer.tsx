import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { dirQueryOptions } from "@/lib/query";
import { fileIcon, formatSize, fileTypeColor } from "@/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Explorer() {
  const { path } = useSearch({ from: "/" });
  const navigate = useNavigate();
  const { data: entries, isLoading, error } = useQuery(dirQueryOptions(path));

  const goDir = (p: string) => navigate({ to: "/", search: { path: p } });
  const goFile = (p: string) => navigate({ to: "/view", search: { path: p } });

  // ─── Breadcrumbs ─────────────────────────────────────────────
  const parts = path.split("/").filter(Boolean);
  const crumbs = [
    { name: "All files", path: "/" },
    ...parts.map((p, i) => ({
      name: p,
      path: "/" + parts.slice(0, i + 1).join("/") + "/",
    })),
  ];

  return (
    <div className="min-h-screen bg-[var(--dropbox-gray-50)] view-enter">
      {/* Top bar */}
      <header className="bg-white border-b border-[var(--dropbox-gray-300)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#0061FE" />
              <path d="M8 10L14 6L20 10L14 14L8 10Z" fill="white" opacity="0.9" />
              <path d="M8 14L14 10L20 14L14 18L8 14Z" fill="white" opacity="0.7" />
              <path d="M8 18L14 14L20 18L14 22L8 18Z" fill="white" opacity="0.5" />
            </svg>
            <span className="text-lg font-semibold text-[var(--dropbox-gray-900)]">tunelo</span>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-2">
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((bc, i) => (
              <BreadcrumbItem key={bc.path}>
                {i > 0 && <BreadcrumbSeparator />}
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="font-semibold text-[var(--dropbox-gray-900)]">
                    {bc.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer px-1.5 py-0.5 rounded-md text-[var(--dropbox-gray-700)] hover:text-[var(--dropbox-gray-900)] hover:bg-[var(--dropbox-gray-100)]"
                    onClick={(e) => {
                      e.preventDefault();
                      goDir(bc.path);
                    }}
                    href="#"
                  >
                    {bc.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {isLoading && <LoadingSkeleton />}

        {error && (
          <div className="text-center py-20 content-reveal">
            <div className="inline-flex items-center gap-2 bg-red-50 text-[var(--dropbox-red)] text-sm px-4 py-2.5 rounded-lg">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error.message}
            </div>
          </div>
        )}

        {!isLoading && !error && entries && (
          <div className="bg-white rounded-xl border border-[var(--dropbox-gray-300)] overflow-hidden shadow-sm content-reveal">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 text-xs font-medium text-[var(--dropbox-gray-700)] uppercase tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="px-6 text-right text-xs font-medium text-[var(--dropbox-gray-700)] uppercase tracking-wider w-[100px]">
                    Size
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Parent dir */}
                {path !== "/" && (
                  <FileRow
                    index={0}
                    icon="📁"
                    name=".."
                    size="—"
                    onClick={() => {
                      const parent =
                        path.replace(/\/$/, "").split("/").slice(0, -1).join("/") || "/";
                      goDir(parent.endsWith("/") ? parent : parent + "/");
                    }}
                  />
                )}

                {/* File entries */}
                {entries.map((entry, i) => {
                  const fullPath = (path.endsWith("/") ? path : path + "/") + entry.name;
                  const color = fileTypeColor(entry.name, entry.is_dir);
                  return (
                    <FileRow
                      key={entry.name}
                      index={i + (path !== "/" ? 1 : 0)}
                      icon={fileIcon(entry.name, entry.is_dir)}
                      name={entry.name + (entry.is_dir ? "/" : "")}
                      size={entry.is_dir ? "—" : formatSize(entry.size)}
                      badge={
                        !entry.is_dir
                          ? { label: entry.name.split(".").pop() ?? "", color }
                          : undefined
                      }
                      onClick={() =>
                        entry.is_dir ? goDir(fullPath + "/") : goFile(fullPath)
                      }
                    />
                  );
                })}
              </TableBody>
            </Table>

            {/* Empty state */}
            {entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 content-reveal">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="6" y="12" width="36" height="28" rx="3" stroke="#D4DCE5" strokeWidth="2" />
                  <path d="M6 18H42" stroke="#D4DCE5" strokeWidth="2" />
                </svg>
                <p className="text-sm text-[var(--dropbox-gray-500)]">This folder is empty</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-6 pb-6 text-center">
        <span className="text-xs text-[var(--dropbox-gray-500)]">
          Served by{" "}
          <span className="font-semibold text-[var(--dropbox-blue)]">tunelo</span>
        </span>
      </div>
    </div>
  );
}

// ─── File Row ──────────────────────────────────────────────────
interface FileRowProps {
  index: number;
  icon: string;
  name: string;
  size: string;
  badge?: { label: string; color: string };
  onClick: () => void;
}

function FileRow({ index, icon, name, size, badge, onClick }: FileRowProps) {
  const delay = Math.min(index * 50, 500);

  return (
    <TableRow
      className="stagger-item cursor-pointer group"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <TableCell className="px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <span
            className="text-sm text-[var(--dropbox-gray-900)] group-hover:text-[var(--dropbox-blue)] font-medium truncate"
            style={{ transition: "color 150ms var(--ease-out)" }}
          >
            {name}
          </span>
          {badge && (
            <Badge
              variant="outline"
              className="flex-shrink-0 text-[10px] font-semibold uppercase border-transparent"
              style={{ color: badge.color, backgroundColor: badge.color + "15" }}
            >
              {badge.label}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-3 text-right text-sm text-[var(--dropbox-gray-500)] tabular-nums">
        {size}
      </TableCell>
    </TableRow>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[var(--dropbox-gray-300)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-[1fr_100px] px-6 py-3 border-b border-[var(--dropbox-gray-100)]">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-8 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_100px] px-6 py-3 border-b border-[var(--dropbox-gray-100)] last:border-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-3.5 rounded" style={{ width: `${120 + Math.random() * 140}px` }} />
          </div>
          <Skeleton className="h-3 w-14 ml-auto self-center rounded" />
        </div>
      ))}
    </div>
  );
}
