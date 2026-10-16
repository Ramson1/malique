"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileType,
  File,
  Download,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Button,
  Input,
  Select,
  Card,
  PageHeader,
  SegmentedControl,
  useToast,
} from "@/components/ui";
import { api, API_URL } from "@/lib/api/client";

interface Dataset {
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
  numericCols: number[];
}
interface BranchOption {
  id: string;
  name: string;
}

type Kind = string;

const KINDS: { value: Kind; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "orders", label: "Orders" },
  { value: "pos-sales", label: "POS Sales" },
  { value: "customers", label: "Customers" },
  { value: "products", label: "Products" },
  { value: "inventory", label: "Inventory" },
  { value: "deliveries", label: "Deliveries" },
  { value: "staff", label: "Staff" },
  { value: "branches", label: "Branches" },
  { value: "gas-balance", label: "Gas Balance" },
  { value: "attendance", label: "Attendance" },
  { value: "payroll", label: "Payroll" },
  { value: "announcements", label: "Announcements" },
  { value: "messages", label: "Messages" },
  { value: "audit", label: "Audit Trail" },
];

const FORMATS: { fmt: string; label: string; icon: any }[] = [
  { fmt: "pdf", label: "PDF", icon: FileText },
  { fmt: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { fmt: "docx", label: "Word", icon: FileType },
  { fmt: "csv", label: "CSV", icon: File },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export default function ReportsPage() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("sales");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(ymd(new Date()));
  const [period, setPeriod] = useState(startOfMonth());
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<{ branches: BranchOption[] }>("/admin/branches");
        setBranches(d.branches ?? []);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const filterParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {};
    if (branchId) p.branchId = branchId;
    if (kind === "payroll") {
      p.period = period;
    } else {
      if (from) p.from = from;
      if (to) p.to = to;
    }
    return p;
  }, [kind, branchId, from, to, period]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const p = filterParams();
      const q = new URLSearchParams({ format: "csv", ...p }).toString();
      const d = await api.get<Dataset>(`/admin/reports/${kind}/data?${q}`);
      setData(d);
    } catch {
      toast.error("Could not build the report preview.");
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, filterParams]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function download(fmt: string) {
    setDownloading(fmt);
    try {
      const p = filterParams();
      const q = new URLSearchParams({ format: fmt, ...p }).toString();
      const res = await fetch(`${API_URL}/admin/reports/${kind}?${q}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Export failed");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${kind}-${fmt}.${fmt}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not export the report.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardLayout title="Reports" subtitle="Build, preview and export operational reports">
      <div className="space-y-6">
        <PageHeader
          title="Reports & Exports"
          description="Filter any report and download it as PDF, Excel, Word or CSV. Every export carries a timestamp and the applied filters."
          icon={<BarChart3 className="w-5 h-5" />}
        />

        {/* Report type */}
        <SegmentedControl
          options={KINDS}
          value={kind}
          onChange={(v) => setKind(v as Kind)}
        />

        {/* Filters + export */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            {kind === "payroll" ? (
              <div className="w-full sm:w-48">
                <Input label="Period" type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="w-full sm:w-44">
                  <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="w-full sm:w-44">
                  <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}

            <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={loadPreview} loading={loading}>
              Refresh
            </Button>

            <div className="ml-auto flex flex-wrap gap-2">
              {FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <Button
                    key={f.fmt}
                    variant={f.fmt === "pdf" ? "primary" : "outline"}
                    leftIcon={<Icon className="w-4 h-4" />}
                    onClick={() => download(f.fmt)}
                    loading={downloading === f.fmt}
                    disabled={loading}
                  >
                    {f.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card padded={false}>
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-navy-900">{data?.title ?? "Report preview"}</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{data?.subtitle ?? " "}</p>
            {data && data.meta.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                {data.meta.map((m) => (
                  <p key={m.label} className="text-sm">
                    <span className="text-slate-500">{m.label}: </span>
                    <span className="font-semibold text-navy-900">{m.value}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-[60vh] overflow-auto">
            {!data ? (
              <p className="py-16 text-center text-sm text-slate-400">
                {loading ? "Building report…" : "No data for the selected filters."}
              </p>
            ) : data.rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">
                No records matched. Adjust the filters and refresh.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    {data.headers.map((h, i) => (
                      <th
                        key={h}
                        className={`border-b border-slate-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                          data.numericCols.includes(i) ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 last:border-0">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-4 py-2.5 text-navy-800 ${
                            data.numericCols.includes(ci) ? "text-right tabular-nums" : "text-left"
                          }`}
                        >
                          {typeof cell === "number" ? cell.toLocaleString("en-NG") : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
