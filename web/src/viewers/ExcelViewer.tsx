import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { arrayBufferQueryOptions } from "@/lib/query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";

export default function ExcelViewer({ path }: { path: string }) {
  const [active, setActive] = useState(0);
  const { data: buf, isLoading, error } = useQuery(arrayBufferQueryOptions(path));

  const sheets = useMemo(() => {
    if (!buf) return [];
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1 }) as string[][],
    }));
  }, [buf]);

  if (error) {
    return <div className="p-8 text-[var(--dropbox-red)] text-sm">{error.message}</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (!sheets.length) {
    return <div className="p-8 text-[var(--dropbox-gray-500)]">No data</div>;
  }

  const sheet = sheets[active];

  return (
    <div className="flex flex-col h-[calc(100vh-53px)]">
      {sheets.length > 1 && (
        <div className="flex gap-1 px-6 pt-3 pb-0 bg-[var(--dropbox-gray-50)] border-b border-[var(--dropbox-gray-300)]">
          {sheets.map((s, i) => (
            <Button
              key={s.name}
              variant={i === active ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActive(i)}
              className={`rounded-t-lg rounded-b-none border border-b-0 ${
                i === active
                  ? "bg-white text-[var(--dropbox-blue)] font-semibold border-[var(--dropbox-gray-300)]"
                  : "border-transparent"
              }`}
            >
              {s.name}
            </Button>
          ))}
        </div>
      )}
      <div className="overflow-auto flex-1 p-6">
        <div className="bg-white rounded-xl border border-[var(--dropbox-gray-300)] overflow-hidden shadow-sm content-reveal">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="bg-[var(--dropbox-gray-100)] border-r border-[var(--dropbox-gray-300)] px-3 py-2 w-12 text-xs text-[var(--dropbox-gray-500)]">
                  #
                </TableHead>
                {(sheet.rows[0] || []).map((_, ci) => (
                  <TableHead
                    key={ci}
                    className="bg-[var(--dropbox-gray-100)] px-4 py-2 text-xs font-semibold text-[var(--dropbox-gray-700)]"
                  >
                    {sheet.rows[0]?.[ci] ?? ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.rows.slice(1).map((row, ri) => (
                <TableRow key={ri}>
                  <TableCell className="bg-[var(--dropbox-gray-50)] border-r border-[var(--dropbox-gray-200)] px-3 py-1.5 text-center text-xs text-[var(--dropbox-gray-500)] tabular-nums">
                    {ri + 2}
                  </TableCell>
                  {(sheet.rows[0] || []).map((_, ci) => (
                    <TableCell key={ci} className="px-4 py-1.5 text-[var(--dropbox-gray-900)]">
                      {row[ci] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
