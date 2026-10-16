"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Plus,
  Eye,
  Trash2,
  Sparkles,
  CheckCircle2,
  Banknote,
  Users,
  TrendingUp,
  TrendingDown,
  Printer,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Card,
  StatTile,
  DataGrid,
  PageHeader,
  type Column,
  useToast,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface Entry {
  id: string;
  type: string;
  amount: number;
  reason?: string;
  sign: number;
}
interface Payslip {
  id: string;
  userId: string;
  staffName: string;
  jobTitle?: string;
  email?: string;
  branchId: string;
  branchName: string;
  period: string;
  status: "draft" | "approved" | "paid";
  basicSalary: number;
  allowances: number;
  overtimePay: number;
  bonus: number;
  deductions: number;
  earnings: number;
  net: number;
  entries: Entry[];
}
interface BranchOption {
  id: string;
  name: string;
}

const ENTRY_TYPES: { value: string; label: string }[] = [
  { value: "allowance", label: "Allowance" },
  { value: "overtime", label: "Overtime" },
  { value: "bonus", label: "Bonus" },
  { value: "increment", label: "Increment" },
  { value: "deduction", label: "Deduction" },
  { value: "penalty", label: "Penalty" },
];

const NEGATIVE_TYPES = new Set(["deduction", "penalty"]);

const STATUS_META: Record<
  string,
  { tone: "slate" | "amber" | "green"; label: string }
> = {
  draft: { tone: "slate", label: "Draft" },
  approved: { tone: "amber", label: "Approved" },
  paid: { tone: "green", label: "Paid" },
};

function money(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function periodLabel(period: string) {
  const d = new Date(`${period}T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}
function qs(params: Record<string, string | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export default function PayrollPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [totals, setTotals] = useState({ gross: 0, deductions: 0, net: 0, count: 0 });
  const [loading, setLoading] = useState(false);

  const [generateModal, setGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [viewSlip, setViewSlip] = useState<Payslip | null>(null);

  const [entryModal, setEntryModal] = useState(false);
  const [entryTarget, setEntryTarget] = useState<Payslip | null>(null);
  const [entryForm, setEntryForm] = useState({
    type: "allowance",
    amount: "",
    reason: "",
  });

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ payslips: Payslip[]; totals: typeof totals }>(
        `/payroll${qs({ branchId: branchId || undefined, period })}`,
      );
      setPayslips(r.payslips ?? []);
      setTotals(r.totals ?? { gross: 0, deductions: 0, net: 0, count: 0 });
    } catch {
      toast.error("Could not load payroll.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, period]);

  useEffect(() => {
    load();
  }, [load]);

  async function runGenerate() {
    setGenerating(true);
    try {
      const r = await api.post<{ created: number; skipped: number }>(
        "/payroll/generate",
        { period, branchId: branchId || undefined },
      );
      toast.success(`Generated ${r.created} payslip(s), ${r.skipped} already existed.`);
      setGenerateModal(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not generate payroll.");
    } finally {
      setGenerating(false);
    }
  }

  function openEntry(p: Payslip) {
    setEntryTarget(p);
    setEntryForm({ type: "allowance", amount: "", reason: "" });
    setEntryModal(true);
  }

  async function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entryTarget) return;
    const amount = Number(entryForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    try {
      await api.post("/payroll/entry", {
        userId: entryTarget.userId,
        period: entryTarget.period,
        type: entryForm.type,
        amount,
        reason: entryForm.reason || undefined,
      });
      toast.success("Line item added.");
      setEntryModal(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not add line item.");
    }
  }

  async function removeEntry(entryId: string) {
    try {
      await api.delete(`/payroll/entry/${entryId}`);
      toast.success("Line item removed.");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove line item.");
    }
  }

  async function advanceStatus(p: Payslip) {
    const next =
      p.status === "draft" ? "approved" : p.status === "approved" ? "paid" : "draft";
    try {
      await api.patch(`/payroll/${p.id}/status`, { status: next });
      toast.success(`Payslip marked ${next}.`);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update status.");
    }
  }

  const columns = useMemo<Column<Payslip>[]>(
    () => [
      {
        key: "staffName",
        header: "Staff",
        sortable: true,
        sortValue: (r) => r.staffName,
        render: (r) => (
          <div>
            <p className="font-medium text-navy-900">{r.staffName}</p>
            <p className="text-xs text-slate-400">{r.jobTitle ?? r.branchName}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center",
        render: (r) => {
          const m = STATUS_META[r.status] ?? STATUS_META.draft;
          return <Badge tone={m.tone}>{m.label}</Badge>;
        },
      },
      {
        key: "earnings",
        header: "Earnings",
        align: "right",
        sortable: true,
        sortValue: (r) => r.earnings,
        render: (r) => <span className="text-sm text-emerald-600">{money(r.earnings)}</span>,
      },
      {
        key: "deductions",
        header: "Deductions",
        align: "right",
        sortable: true,
        sortValue: (r) => r.deductions,
        render: (r) => (
          <span className={`text-sm ${r.deductions > 0 ? "text-red-600" : "text-slate-400"}`}>
            {money(r.deductions)}
          </span>
        ),
      },
      {
        key: "net",
        header: "Net Pay",
        align: "right",
        sortable: true,
        sortValue: (r) => r.net,
        render: (r) => (
          <span className="text-sm font-semibold text-navy-900">{money(r.net)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardLayout title="Payroll" subtitle={`Pay period: ${periodLabel(period)}`}>
      <div className="space-y-6">
        <PageHeader
          title="Payroll & Salaries"
          description="Generate payslips from base salary, add increments, allowances or deductions, then approve and mark as paid."
          icon={<Wallet className="w-5 h-5" />}
          actions={
            <Button
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4" />}
              onClick={() => setGenerateModal(true)}
            >
              Generate Payroll
            </Button>
          }
        />

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <Input label="Period" type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
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
            <div className="ml-auto flex items-center gap-2">
              <ExportMenu kind="payroll" filters={{ branchId, period }} />
              <Button variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
        </Card>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={<Users className="w-5 h-5" />} label="Payslips" value={String(totals.count)} accent="navy" />
          <StatTile icon={<TrendingUp className="w-5 h-5" />} label="Gross" value={money(totals.gross)} accent="green" />
          <StatTile icon={<TrendingDown className="w-5 h-5" />} label="Deductions" value={money(totals.deductions)} accent="red" />
          <StatTile icon={<Banknote className="w-5 h-5" />} label="Net Payable" value={money(totals.net)} accent="amber" />
        </div>

        <DataGrid
          columns={columns}
          rows={payslips}
          loading={loading}
          getRowId={(r) => r.id}
          emptyTitle={period ? "No payslips for this period" : "Select a period"}
          emptyHint="Use “Generate Payroll” to draft payslips for every active staff member from their base salary."
          emptyIcon={<Wallet className="h-6 w-6" />}
          rowActions={(r) => (
            <>
              <Button variant="ghost" size="sm" leftIcon={<Eye className="w-4 h-4" />} onClick={() => setViewSlip(r)}>
                View
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => openEntry(r)}>
                Add
              </Button>
              <Button
                variant={r.status === "paid" ? "outline" : "secondary"}
                size="sm"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => advanceStatus(r)}
              >
                {r.status === "draft" ? "Approve" : r.status === "approved" ? "Mark Paid" : "Reopen"}
              </Button>
            </>
          )}
        />
      </div>

      {/* Generate modal */}
      <Modal
        open={generateModal}
        onClose={() => setGenerateModal(false)}
        title="Generate Payroll"
        description={`Create draft payslips for ${periodLabel(period)}. Each active, branched staff member gets a payslip seeded with their base salary.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={runGenerate} loading={generating}>
              Generate
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <span className="font-medium text-navy-900">Period:</span> {periodLabel(period)}
          </p>
          <p>
            <span className="font-medium text-navy-900">Scope:</span>{" "}
            {branchId ? branches.find((b) => b.id === branchId)?.name : "All branches"}
          </p>
          <p className="text-xs text-slate-500">
            Existing payslips for the period are left untouched, so it is safe to re-run.
          </p>
        </div>
      </Modal>

      {/* Add entry modal */}
      <Modal
        open={entryModal}
        onClose={() => setEntryModal(false)}
        title="Add Line Item"
        description={entryTarget ? `${entryTarget.staffName} · ${periodLabel(entryTarget.period)}` : ""}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEntryModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="entry-form">
              Add Item
            </Button>
          </>
        }
      >
        <form id="entry-form" onSubmit={submitEntry} className="space-y-4">
          <Select
            label="Type"
            value={entryForm.type}
            onChange={(e) => setEntryForm({ ...entryForm, type: e.target.value })}
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} {NEGATIVE_TYPES.has(t.value) ? "(reduces pay)" : "(adds to pay)"}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            label="Amount (₦)"
            value={entryForm.amount}
            onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
            required
          />
          <Input
            label="Reason (optional)"
            value={entryForm.reason}
            onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })}
            placeholder="e.g. Transport allowance, March"
          />
        </form>
      </Modal>

      {/* Payslip detail modal */}
      <Modal
        open={!!viewSlip}
        onClose={() => setViewSlip(null)}
        title={viewSlip ? `Payslip — ${viewSlip.staffName}` : "Payslip"}
        description={viewSlip ? `${viewSlip.branchName} · ${periodLabel(viewSlip.period)}` : ""}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewSlip(null)}>
              Close
            </Button>
            {viewSlip && (
              <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print
              </Button>
            )}
          </>
        }
      >
        {viewSlip && (
          <div id="payslip-print" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <Badge tone={(STATUS_META[viewSlip.status] ?? STATUS_META.draft).tone}>
                  {(STATUS_META[viewSlip.status] ?? STATUS_META.draft).label}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Net Pay</p>
                <p className="text-xl font-bold text-navy-900">{money(viewSlip.net)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {viewSlip.entries.map((en) => (
                    <tr key={en.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium capitalize text-navy-900">{en.type}</td>
                      <td className="px-3 py-2 text-slate-500">{en.reason ?? "—"}</td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          en.sign < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {en.sign < 0 ? "−" : "+"}
                        {money(en.amount)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {en.type !== "basic" && viewSlip.status !== "paid" && (
                          <button
                            onClick={() => removeEntry(en.id)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-navy-900" colSpan={2}>
                      Gross {money(viewSlip.earnings)} − Deductions {money(viewSlip.deductions)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-navy-900">
                      {money(viewSlip.net)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
