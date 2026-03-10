"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Star, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { parseReviewFile, type ParsedReviewRow, type ParseError } from "@/lib/review-file-parser";
import { parseRelativeDateToDays, resolveImportDates } from "@/lib/review-date-parser";
import { format } from "date-fns";

type UiState = "idle" | "parsing" | "preview" | "importing" | "done";

interface TenantOption {
  id: string;
  name: string;
}

export default function AdminReviewsPage() {
  const [state, setState] = useState<UiState>("idle");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [rows, setRows] = useState<ParsedReviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [resolvedDates, setResolvedDates] = useState<Date[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tenants } = useQuery<TenantOption[]>({
    queryKey: ["admin-tenants-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tenants/list");
      if (!res.ok) throw new Error("Failed to fetch tenants");
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 300000,
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { tenantId: string; reviews: ParsedReviewRow[] }) => {
      const res = await fetch("/api/admin/reviews/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error || "Import failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportedCount(data.data?.imported ?? rows.length);
      setState("done");
      setImportError("");
    },
    onError: (err: Error) => {
      setImportError(err.message);
    },
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setState("parsing");
    setImportError("");
    const result = await parseReviewFile(file);
    const allErrors = [...result.errors];

    // Filter out rows with unparseable dates, add them as errors
    const validRows: typeof result.rows = [];
    for (let i = 0; i < result.rows.length; i++) {
      const r = result.rows[i];
      if (parseRelativeDateToDays(r.relativeDate) === null) {
        allErrors.push({ row: (r.serialNumber ?? i + 1) + 1, message: `Cannot parse date "${r.relativeDate}"` });
      } else {
        validRows.push(r);
      }
    }

    setParseErrors(allErrors);

    if (validRows.length === 0) {
      setRows([]);
      setResolvedDates([]);
      setState("preview");
      return;
    }

    // Resolve collision-free dates for preview
    const daysAgo = validRows.map((r) => parseRelativeDateToDays(r.relativeDate)!);
    const dates = resolveImportDates(daysAgo);

    setRows(validRows);
    setResolvedDates(dates);
    setState("preview");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleImport = () => {
    if (!selectedTenantId || rows.length === 0) return;
    setState("importing");
    importMutation.mutate({ tenantId: selectedTenantId, reviews: rows });
  };

  const handleReset = () => {
    setState("idle");
    setRows([]);
    setParseErrors([]);
    setResolvedDates([]);
    setImportedCount(0);
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canImport = selectedTenantId && rows.length > 0;

  return (
    <div>
      <PageHeader title="Import Reviews" description="Bulk import reviews from CSV or Excel files" />

      {/* Tenant Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Tenant</label>
        <Select
          className="max-w-sm"
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
        >
          <option value="">Choose a business...</option>
          {tenants?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Done State */}
      {state === "done" && (
        <div className="rounded-lg border bg-green-50 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-800">Import Complete</h3>
          <p className="text-green-700 mt-1">{importedCount} reviews imported successfully.</p>
          <Button className="mt-4" onClick={handleReset}>
            Import More
          </Button>
        </div>
      )}

      {/* Upload Zone */}
      {(state === "idle" || state === "parsing") && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors p-12 text-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          {state === "parsing" ? (
            <div className="text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 animate-pulse" />
              <p className="text-sm">Parsing file...</p>
            </div>
          ) : (
            <div className="text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-3" />
              <p className="font-medium">Drop a CSV or Excel file here</p>
              <p className="text-sm mt-1">or click to browse (.csv, .xlsx, .xls)</p>
            </div>
          )}
        </div>
      )}

      {/* Parse Errors */}
      {parseErrors.length > 0 && state === "preview" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mt-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h4 className="font-medium text-red-800">
              {parseErrors.length} row{parseErrors.length > 1 ? "s" : ""} with errors
            </h4>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {parseErrors.map((err, i) => (
              <li key={i}>
                Row {err.row}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Import Error */}
      {importError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mt-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{importError}</p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {state === "preview" && rows.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{rows.length} reviews ready to import</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                Import {rows.length} Reviews
              </Button>
            </div>
          </div>

          <div className="rounded-lg border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Rating</TableHead>
                  <TableHead>Original Date</TableHead>
                  <TableHead>Calculated Date</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="w-20">Photos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.serialNumber ?? i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                s < row.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.relativeDate}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(resolvedDates[i], "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {row.comment || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {row.photoUrls.length || "—"}
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Importing State */}
      {state === "importing" && (
        <div className="rounded-lg border p-8 text-center mt-6">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 animate-pulse text-primary" />
          <p className="text-muted-foreground">Importing {rows.length} reviews...</p>
        </div>
      )}

      {/* Empty preview state (all rows had errors) */}
      {state === "preview" && rows.length === 0 && parseErrors.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={handleReset}>
            Try Another File
          </Button>
        </div>
      )}
    </div>
  );
}
