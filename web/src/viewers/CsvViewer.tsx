import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { textQueryOptions } from "@/lib/query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import Papa from "papaparse";

export default function CsvViewer({ path }: { path: string }) {
  const { data: text, isLoading, error } = useQuery(textQueryOptions(path));

  const rows = useMemo(() => {
    if (!text) return [];
    const result = Papa.parse<string[]>(text, { header: false });
    return result.data.filter((r) => r.some((c) => c.trim()));
  }, [text]);

  if (error) {
    return <div className="p-8 text-[var(--dropbox-red)] text-sm">{error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-[var(--dropbox-gray-300)] overflow-hidden shadow-sm p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return <div className="p-8 text-[var(--dropbox-gray-500)]">No data</div>;
  }

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="overflow-auto max-h-[calc(100vh-53px)] p-6">
      <div className="bg-white rounded-xl border border-[var(--dropbox-gray-300)] overflow-hidden shadow-sm content-reveal">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="bg-[var(--dropbox-gray-100)] px-4 py-2.5 text-xs font-semibold text-[var(--dropbox-gray-700)] w-12">
                #
              </TableHead>
              {header.map((h, i) => (
                <TableHead
                  key={i}
                  className="bg-[var(--dropbox-gray-100)] px-4 py-2.5 text-xs font-semibold text-[var(--dropbox-gray-700)]"
                >
                  {h || `Column ${i + 1}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {body.map((row, ri) => (
              <TableRow key={ri}>
                <TableCell className="px-4 py-2 text-xs text-[var(--dropbox-gray-500)] tabular-nums">
                  {ri + 1}
                </TableCell>
                {row.map((cell, ci) => (
                  <TableCell key={ci} className="px-4 py-2 text-[var(--dropbox-gray-900)]">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-[var(--dropbox-gray-500)] mt-3 text-center">
        {body.length} rows × {header.length} columns
      </p>
    </div>
  );
}
