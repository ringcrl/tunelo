import type { FileEntry } from "./types";

export async function listDir(path: string): Promise<FileEntry[]> {
  const res = await fetch(`/_api/ls?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to list: ${res.status}`);
  return res.json();
}

export function rawUrl(path: string): string {
  return `/_api/raw?path=${encodeURIComponent(path)}`;
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(rawUrl(path));
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.text();
}

export async function fetchArrayBuffer(path: string): Promise<ArrayBuffer> {
  const res = await fetch(rawUrl(path));
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.arrayBuffer();
}
