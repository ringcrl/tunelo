import { queryOptions } from "@tanstack/react-query";
import { listDir, fetchText, fetchArrayBuffer } from "@/api";

export const dirQueryOptions = (path: string) =>
  queryOptions({
    queryKey: ["dir", path],
    queryFn: () => listDir(path),
    staleTime: 30_000,
  });

export const textQueryOptions = (path: string) =>
  queryOptions({
    queryKey: ["text", path],
    queryFn: () => fetchText(path),
    staleTime: 60_000,
  });

export const arrayBufferQueryOptions = (path: string) =>
  queryOptions({
    queryKey: ["arraybuffer", path],
    queryFn: () => fetchArrayBuffer(path),
    staleTime: 60_000,
  });
