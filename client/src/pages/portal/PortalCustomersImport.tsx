/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
/**
 * Customer CSV import — paste / upload a CSV, map fields, import.
 * Designed against ServiceM8's standard "Clients" export but works with
 * any CSV that has at least a name + (phone OR email) column.
 *
 * The flow keeps everything client-side until the final import:
 *   1. Tradie pastes CSV or picks a file
 *   2. We parse it (small inline parser — no extra deps)
 *   3. Auto-detect column mapping (heuristic on header names)
 *   4. Show preview with mapping editable per-column
 *   5. On Import, send the mapped rows to customerImport.importCsv
 *   6. Show summary card with counts + first few errors
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Upload, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { WriteGuard } from "@/components/portal/ViewerBanner";

/** Customer fields we'll map columns INTO. */
const TARGET_FIELDS = ["name", "email", "phone", "address", "suburb", "state", "postcode", "notes"] as const;
type TargetField = typeof TARGET_FIELDS[number] | "(skip)";

/**
 * Column-name aliases for auto-detection. Lowercased + stripped.
 * Order matters — first hit wins so put the most specific aliases first.
 */
const FIELD_ALIASES: Record<Exclude<TargetField, "(skip)">, string[]> = {
  name: ["name", "customer name", "contact name", "full name", "client name", "company name"],
  email: ["email", "email address", "email1", "primary email"],
  phone: ["mobile", "phone", "phone number", "mobile number", "primary phone", "contact phone", "telephone", "phone1"],
  address: ["address", "address line 1", "address1", "street address", "street"],
  suburb: ["suburb", "city", "town", "address line 2"],
  state: ["state", "region", "province"],
  postcode: ["postcode", "post code", "postal code", "zip", "zip code"],
  notes: ["notes", "comments", "description", "memo"],
};

export default function PortalCustomersImport() {
  const [, navigate] = useLocation();
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<number, TargetField>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skippedDuplicate: number; skippedInvalid: number; totalProcessed: number; errors: Array<{ rowIndex: number; reason: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importMutation = trpc.customerImport.importCsv.useMutation({
    onSuccess: (res) => {
      hapticSuccess();
      setResult(res);
      utils.portalCustomers.list.invalidate();
      if (res.imported > 0) {
        toast.success(`${res.imported} customer${res.imported === 1 ? "" : "s"} imported`);
      } else if (res.skippedDuplicate > 0 && res.imported === 0) {
        toast.info("All rows already existed — nothing new to import.");
      }
    },
    onError: (err) => {
      hapticWarning();
      toast.error(err.message ?? "Import failed.");
    },
  });

  const handleParse = useCallback((text: string) => {
    setParseError(null);
    setResult(null);
    if (!text.trim()) {
      setParsed(null);
      setMapping({});
      return;
    }
    try {
      const result = parseCsv(text);
      if (result.rows.length === 0) {
        setParseError("No data rows found below the header.");
        setParsed(null);
        return;
      }
      setParsed(result);
      setMapping(autoMapColumns(result.headers));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't parse the CSV.");
      setParsed(null);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("CSV too large — keep it under 5 MB.");
      return;
    }
    const text = await file.text();
    setCsvText(text);
    handleParse(text);
  }, [handleParse]);

  // Build the rows that will go to the server based on the current mapping
  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map(row => {
      const out: Record<string, string> = {};
      for (const [colIdxStr, target] of Object.entries(mapping)) {
        if (target === "(skip)") continue;
        const colIdx = Number(colIdxStr);
        const cell = row[colIdx] ?? "";
        // If two source columns map to the same target, last one wins
        // (rare in practice — happens when a sheet has duplicate Phone columns).
        out[target] = cell;
      }
      return out;
    });
  }, [parsed, mapping]);

  const previewRows = mappedRows.slice(0, 10);
  const hasNameMapped = Object.values(mapping).includes("name");
  const hasContactMapped = Object.values(mapping).includes("phone") || Object.values(mapping).includes("email");

  const handleImport = useCallback(() => {
    if (!hasNameMapped) {
      toast.error("Map a column to 'Name' first — every customer needs at least a name.");
      return;
    }
    if (!hasContactMapped) {
      toast.error("Map a column to either 'Phone' or 'Email' — we need one way to contact them.");
      return;
    }
    importMutation.mutate({ rows: mappedRows });
  }, [hasNameMapped, hasContactMapped, mappedRows, importMutation]);

  return (
    <PortalLayout activeTab="customers">
      <div className="space-y-4">
        <Link href="/portal/customers">
          <a className="inline-flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to customers
          </a>
        </Link>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
            <FileSpreadsheet className="w-5 h-5" style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Import Customers from CSV</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              Paste a ServiceM8, Tradify, MYOB or generic customer export. We'll auto-detect the columns.
            </p>
          </div>
        </div>

        {/* Help card */}
        <div
          className="rounded-xl p-3 text-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}
        >
          <p className="font-semibold text-white mb-1.5">From ServiceM8:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>ServiceM8 dashboard → <em>Reports</em> → <em>Clients</em> → Export CSV</li>
            <li>Open the file (Excel/Numbers), select all, copy, paste below</li>
            <li>Or upload the file directly</li>
          </ol>
        </div>

        {/* Result card (after import completes) */}
        {result && <ResultCard result={result} onReset={() => { setResult(null); setCsvText(""); setParsed(null); setMapping({}); }} onViewCustomers={() => navigate("/portal/customers")} />}

        {!result && (
          <>
            {/* Source */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>
                Paste CSV or upload a file
              </label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                onBlur={e => handleParse(e.target.value)}
                placeholder="name,email,phone,address&#10;John Smith,john@example.com,0412 345 678,123 Main St"
                rows={8}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", minHeight: 120 }}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                >
                  <Upload className="w-3.5 h-3.5" /> Upload CSV file
                </button>
                {csvText && (
                  <button
                    type="button"
                    onClick={() => handleParse(csvText)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Re-parse
                  </button>
                )}
              </div>
              {parseError && (
                <p className="text-xs" style={{ color: "#ef4444" }}>
                  <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" /> {parseError}
                </p>
              )}
            </div>

            {/* Mapping + preview */}
            {parsed && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Map columns ({parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} detected)
                </h2>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  We've auto-detected the mapping. Adjust below if anything's wrong.
                </p>
                <div className="space-y-1.5">
                  {parsed.headers.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className="flex-1 px-3 py-2 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}
                      >
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Column</span>
                        <p className="font-semibold truncate">{header}</p>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
                      <select
                        value={mapping[idx] ?? "(skip)"}
                        onChange={e => setMapping({ ...mapping, [idx]: e.target.value as TargetField })}
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                      >
                        <option value="(skip)">(skip)</option>
                        {TARGET_FIELDS.map(f => (
                          <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Preview (first 10 rows)
                  </h3>
                  <div className="rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {TARGET_FIELDS.map(f => (
                            <th key={f} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                              {f}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            {TARGET_FIELDS.map(f => (
                              <td key={f} className="px-3 py-1.5 truncate max-w-[160px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                                {r[f] ?? <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation hints */}
                {(!hasNameMapped || !hasContactMapped) && (
                  <div
                    className="flex items-start gap-2 p-3 rounded-lg text-xs"
                    style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", color: "rgba(255,200,140,0.9)" }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      Map at least:
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {!hasNameMapped && <li><strong>Name</strong> — every customer needs one.</li>}
                        {!hasContactMapped && <li><strong>Phone</strong> or <strong>Email</strong> — we need one way to reach them.</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Import button */}
                <WriteGuard>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={importMutation.isPending || !hasNameMapped || !hasContactMapped}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold disabled:opacity-50"
                    style={{ background: "#F5A623", color: "#0F1F3D", minHeight: 48 }}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Importing {mappedRows.length} customer{mappedRows.length === 1 ? "" : "s"}…
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Import {mappedRows.length} customer{mappedRows.length === 1 ? "" : "s"}
                      </>
                    )}
                  </button>
                </WriteGuard>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
}

// ─── Result card ────────────────────────────────────────────────────────────

function ResultCard({ result, onReset, onViewCustomers }: {
  result: { imported: number; skippedDuplicate: number; skippedInvalid: number; totalProcessed: number; errors: Array<{ rowIndex: number; reason: string }> };
  onReset: () => void;
  onViewCustomers: () => void;
}) {
  const allOk = result.imported > 0 && result.skippedInvalid === 0;
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: allOk ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${allOk ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}` }}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: allOk ? "#4ade80" : "#F5A623" }} />
        <div>
          <p className="text-base font-bold text-white">Import complete</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            Processed {result.totalProcessed} row{result.totalProcessed === 1 ? "" : "s"} from your CSV.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Imported" value={result.imported} color="#4ade80" />
        <Stat label="Already existed" value={result.skippedDuplicate} color="rgba(255,255,255,0.5)" />
        <Stat label="Skipped" value={result.skippedInvalid} color={result.skippedInvalid > 0 ? "#F5A623" : "rgba(255,255,255,0.5)"} />
      </div>
      {result.errors.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
            {result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped — see details
          </summary>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            {result.errors.map((e, i) => (
              <li key={i}>Row {e.rowIndex + 2}: {e.reason}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onViewCustomers}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "#F5A623", color: "#0F1F3D" }}
        >
          View customers
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
        >
          Import another
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
    </div>
  );
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV string. Handles:
 *   - quoted strings ("a,b,c" stays one cell)
 *   - escaped double-quotes inside quoted strings ("" → ")
 *   - Windows CRLF line endings
 *
 * Doesn't try to be a full RFC 4180 implementation — the goal is "exports
 * from ServiceM8/Tradify/Excel work". Throws on extreme malformedness.
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop trailing empty rows that often come from a final newline
  while (rows.length > 0 && rows[rows.length - 1].every(c => c.trim() === "")) {
    rows.pop();
  }

  if (rows.length < 2) {
    throw new Error("CSV needs at least a header row and one data row.");
  }

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

/**
 * Heuristic auto-mapping. Lowercases each header and looks for an alias
 * match. Same target can't be assigned twice — first column wins.
 */
function autoMapColumns(headers: string[]): Record<number, TargetField> {
  const mapping: Record<number, TargetField> = {};
  const used = new Set<TargetField>();
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    let matched: TargetField = "(skip)";
    for (const [target, aliases] of Object.entries(FIELD_ALIASES) as Array<[Exclude<TargetField, "(skip)">, string[]]>) {
      if (used.has(target)) continue;
      if (aliases.some(a => h === a || h.includes(a))) {
        matched = target;
        break;
      }
    }
    if (matched !== "(skip)") used.add(matched);
    mapping[i] = matched;
  }
  return mapping;
}
