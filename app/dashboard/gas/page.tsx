"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Flame,
  Plus,
  Scale,
  Gauge,
  Fuel,
  Package,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Boxes,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Tabs,
  DataGrid,
  PageHeader,
  StatTile,
  Card,
  useToast,
  type Column,
  type TabItem,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

// ─── Types ───────────────────────────────────────────────
interface BranchOption {
  id: string;
  name: string;
}

interface Balance {
  period: { from: string; to: string };
  branchId: string | null;
  openingKg: number;
  purchasesKg: number;
  dispensedKg: number;
  expectedClosingKg: number;
  actualClosingKg: number;
  hasActual: boolean;
  varianceKg: number;
  variancePct: number;
  status: "ok" | "warning" | "critical";
  shrinkageKg: number;
  currentOnHandKg: number;
}

interface Purchase {
  id: string;
  branchName: string;
  supplierName: string;
  purchaseDate: string;
  volumeKg: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

interface Reading {
  id: string;
  branchName: string;
  tankName: string;
  readAt: string;
  volumeLiters: number;
  volumeKg: number;
  note?: string;
}

interface Fill {
  id: string;
  branchName: string;
  cylinderSerial: string;
  cylinderSizeKg: number;
  filledKg: number;
  filledAt: string;
}

interface Reconciliation {
  id: string;
  branchName: string;
  periodStart: string;
  periodEnd: string;
  openingKg: number;
  purchasesKg: number;
  dispensedKg: number;
  expectedKg: number;
  closingKg: number;
  varianceKg: number;
  variancePct: number;
  status: string;
  createdAt: string;
}

interface TankOption {
  id: string;
  tankName: string;
}
interface CylinderOption {
  id: string;
  serialNumber: string;
  sizeKg: number;
}

// ─── Helpers ─────────────────────────────────────────────
const STATUS_META: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" }
> = {
  ok: { label: "Balanced", tone: "green" },
  warning: { label: "Watch", tone: "amber" },
  critical: { label: "Shrinkage", tone: "red" },
};

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kg(n: number): string {
  return `${n.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg`;
}

/** Download an array of flat objects as a CSV file. */
function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const s = val == null ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function localNowInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function localToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GasPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  const [tanks, setTanks] = useState<TankOption[]>([]);
  const [cylinders, setCylinders] = useState<CylinderOption[]>([]);

  const [purchaseModal, setPurchaseModal] = useState(false);
  const [readingModal, setReadingModal] = useState(false);
  const [fillModal, setFillModal] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  // Purchase form
  const [pForm, setPForm] = useState({
    branchId: "",
    supplierName: "",
    purchaseDate: localToday(),
    volumeKg: "",
    unitCost: "",
    notes: "",
  });
  // Reading form
  const [rForm, setRForm] = useState({
    branchId: "",
    bulkStorageId: "",
    readAt: localNowInput(),
    volumeLiters: "",
    note: "",
  });
  // Fill form
  const [fForm, setFForm] = useState({
    branchId: "",
    cylinderId: "",
    filledKg: "",
    filledAt: localNowInput(),
  });

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const data = await api.get<Balance>(
        `/gas/balance${qs({ branchId, from, to })}`,
      );
      setBalance(data);
    } catch {
      toast.error("Could not load the gas balance.");
    } finally {
      setLoadingBalance(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, from, to]);

  const loadLedgers = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const [pu, re, fi, rc] = await Promise.all([
        api.get<{ purchases: Purchase[] }>(`/gas/purchases${qs({ branchId })}`),
        api.get<{ readings: Reading[] }>(`/gas/readings${qs({ branchId })}`),
        api.get<{ fills: Fill[] }>(`/gas/fills${qs({ branchId })}`),
        api.get<{ reconciliations: Reconciliation[] }>(
          `/gas/reconciliations${qs({ branchId })}`,
        ),
      ]);
      setPurchases(pu.purchases ?? []);
      setReadings(re.readings ?? []);
      setFills(fi.fills ?? []);
      setReconciliations(rc.reconciliations ?? []);
    } catch {
      toast.error("Could not load the gas ledgers.");
    } finally {
      setLoadingLedger(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Load branches once.
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{ branches: BranchOption[] }>("/admin/branches");
        setBranches(data.branches ?? []);
      } catch {
        /* non-fatal */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    loadLedgers();
  }, [loadLedgers]);

  // Load tank + cylinder lookups for whichever branch a form targets.
  useEffect(() => {
    const target = rForm.branchId;
    if (!target) {
      setTanks([]);
      return;
    }
    (async () => {
      try {
        const d = await api.get<{ tanks: TankOption[] }>(`/gas/tanks${qs({ branchId: target })}`);
        setTanks(d.tanks ?? []);
      } catch {
        setTanks([]);
      }
    })();
  }, [rForm.branchId]);

  useEffect(() => {
    const target = fForm.branchId;
    if (!target) {
      setCylinders([]);
      return;
    }
    (async () => {
      try {
        const d = await api.get<{ cylinders: CylinderOption[] }>(
          `/gas/cylinders${qs({ branchId: target })}`,
        );
        setCylinders(d.cylinders ?? []);
      } catch {
        setCylinders([]);
      }
    })();
  }, [fForm.branchId]);

  async function submitPurchase(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/gas/purchase", {
        branchId: pForm.branchId,
        supplierName: pForm.supplierName,
        purchaseDate: pForm.purchaseDate,
        volumeKg: Number(pForm.volumeKg),
        unitCost: pForm.unitCost ? Number(pForm.unitCost) : undefined,
        notes: pForm.notes || undefined,
      });
      toast.success("Gas purchase recorded");
      setPurchaseModal(false);
      setPForm({ branchId: "", supplierName: "", purchaseDate: localToday(), volumeKg: "", unitCost: "", notes: "" });
      loadLedgers();
      loadBalance();
    } catch {
      toast.error("Failed to record purchase.");
    }
  }

  async function submitReading(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/gas/reading", {
        branchId: rForm.branchId,
        bulkStorageId: rForm.bulkStorageId || undefined,
        readAt: new Date(rForm.readAt).toISOString(),
        volumeLiters: Number(rForm.volumeLiters),
        note: rForm.note || undefined,
      });
      toast.success("Tank reading saved");
      setReadingModal(false);
      setRForm({ branchId: "", bulkStorageId: "", readAt: localNowInput(), volumeLiters: "", note: "" });
      loadLedgers();
      loadBalance();
    } catch {
      toast.error("Failed to save reading.");
    }
  }

  async function submitFill(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/gas/fill", {
        cylinderId: fForm.cylinderId,
        branchId: fForm.branchId,
        filledKg: Number(fForm.filledKg),
        filledAt: new Date(fForm.filledAt).toISOString(),
      });
      toast.success("Cylinder fill recorded");
      setFillModal(false);
      setFForm({ branchId: "", cylinderId: "", filledKg: "", filledAt: localNowInput() });
      loadLedgers();
      loadBalance();
    } catch {
      toast.error("Failed to record fill.");
    }
  }

  async function handleReconcile() {
    if (!branchId) {
      toast.warning("Select a branch first, then reconcile.");
      return;
    }
    setReconciling(true);
    try {
      const res = await api.post<{ status: string }>("/gas/reconcile", {
        branchId,
        from: from || undefined,
        to: to || undefined,
      });
      toast.success(`Reconciliation saved (${res.status})`);
      loadLedgers();
    } catch {
      toast.error("Could not reconcile. A branch tank reading is required.");
    } finally {
      setReconciling(false);
    }
  }

  const statusMeta = STATUS_META[balance?.status ?? "ok"] ?? STATUS_META.ok;

  // ─── Ledger columns ────────────────────────────────────
  const purchaseColumns: Column<Purchase>[] = [
    { key: "supplier", header: "Supplier", sortable: true, sortValue: (r) => r.supplierName, render: (r) => <span className="text-sm font-medium text-navy-900">{r.supplierName}</span> },
    { key: "branch", header: "Branch", sortable: true, sortValue: (r) => r.branchName, render: (r) => <span className="text-sm text-slate-500">{r.branchName}</span> },
    { key: "date", header: "Date", sortable: true, sortValue: (r) => r.purchaseDate, render: (r) => <span className="text-sm text-slate-500">{fmtDate(r.purchaseDate)}</span> },
    { key: "vol", header: "Volume", align: "right", sortable: true, sortValue: (r) => r.volumeKg, render: (r) => <span className="text-sm font-semibold text-emerald-600">+{kg(r.volumeKg)}</span> },
    { key: "cost", header: "Cost", align: "right", sortable: true, sortValue: (r) => r.totalCost, render: (r) => <span className="text-sm text-slate-600">₦{r.totalCost.toLocaleString("en-NG")}</span> },
  ];

  const readingColumns: Column<Reading>[] = [
    { key: "tank", header: "Tank", sortable: true, sortValue: (r) => r.tankName, render: (r) => <span className="text-sm font-medium text-navy-900">{r.tankName}</span> },
    { key: "branch", header: "Branch", sortable: true, sortValue: (r) => r.branchName, render: (r) => <span className="text-sm text-slate-500">{r.branchName}</span> },
    { key: "read", header: "Read At", sortable: true, sortValue: (r) => r.readAt, render: (r) => <span className="text-sm text-slate-500">{fmtDateTime(r.readAt)}</span> },
    { key: "l", header: "Litres", align: "right", sortable: true, sortValue: (r) => r.volumeLiters, render: (r) => <span className="text-sm text-slate-700">{r.volumeLiters.toLocaleString("en-NG")} L</span> },
    { key: "kg", header: "≈ Mass", align: "right", sortable: true, sortValue: (r) => r.volumeKg, render: (r) => <span className="text-sm font-semibold text-navy-800">{kg(r.volumeKg)}</span> },
  ];

  const fillColumns: Column<Fill>[] = [
    { key: "cyl", header: "Cylinder", sortable: true, sortValue: (r) => r.cylinderSerial, render: (r) => <span className="text-sm font-medium text-navy-900">{r.cylinderSerial}</span> },
    { key: "branch", header: "Branch", sortable: true, sortValue: (r) => r.branchName, render: (r) => <span className="text-sm text-slate-500">{r.branchName}</span> },
    { key: "at", header: "Filled", sortable: true, sortValue: (r) => r.filledAt, render: (r) => <span className="text-sm text-slate-500">{fmtDateTime(r.filledAt)}</span> },
    { key: "kg", header: "Dispensed", align: "right", sortable: true, sortValue: (r) => r.filledKg, render: (r) => <span className="text-sm font-semibold text-red-500">−{kg(r.filledKg)}</span> },
  ];

  const reconColumns: Column<Reconciliation>[] = [
    { key: "branch", header: "Branch", render: (r) => <span className="text-sm font-medium text-navy-900">{r.branchName}</span> },
    { key: "period", header: "Period", render: (r) => <span className="text-sm text-slate-500">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</span> },
    { key: "expected", header: "Expected", align: "right", render: (r) => <span className="text-sm text-slate-600">{kg(r.expectedKg)}</span> },
    { key: "closing", header: "Actual", align: "right", render: (r) => <span className="text-sm text-slate-600">{kg(r.closingKg)}</span> },
    { key: "variance", header: "Variance", align: "right", render: (r) => <span className={`text-sm font-semibold ${r.varianceKg < 0 ? "text-red-600" : "text-emerald-600"}`}>{r.varianceKg > 0 ? "+" : ""}{kg(r.varianceKg)} ({r.variancePct}%)</span> },
    { key: "status", header: "Status", render: (r) => { const m = STATUS_META[r.status] ?? STATUS_META.ok; return <Badge tone={m.tone} dot>{m.label}</Badge>; } },
  ];

  const tabs: TabItem[] = useMemo(
    () => [
      {
        id: "purchases",
        label: "Purchases",
        icon: <Package className="w-4 h-4" />,
        count: purchases.length,
        content: (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setPurchaseModal(true)}>
                Record Purchase
              </Button>
            </div>
            <DataGrid columns={purchaseColumns} rows={purchases} loading={loadingLedger} getRowId={(r) => r.id}
              emptyTitle="No gas purchases yet" emptyHint="Record the gas you buy from suppliers to start tracking intake." />
          </div>
        ),
      },
      {
        id: "readings",
        label: "Tank Readings",
        icon: <Gauge className="w-4 h-4" />,
        count: readings.length,
        content: (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setReadingModal(true)}>
                Add Tank Reading
              </Button>
            </div>
            <DataGrid columns={readingColumns} rows={readings} loading={loadingLedger} getRowId={(r) => r.id}
              emptyTitle="No tank readings yet" emptyHint="Gauge readings capture how much gas is physically in the bulk tanks." />
          </div>
        ),
      },
      {
        id: "fills",
        label: "Cylinder Fills",
        icon: <Fuel className="w-4 h-4" />,
        count: fills.length,
        content: (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setFillModal(true)}>
                Record Fill
              </Button>
            </div>
            <DataGrid columns={fillColumns} rows={fills} loading={loadingLedger} getRowId={(r) => r.id}
              emptyTitle="No cylinder fills yet" emptyHint="Every fill is gas leaving the tank — record it here so nothing goes missing." />
          </div>
        ),
      },
      {
        id: "reconciliations",
        label: "Reconciliations",
        icon: <Scale className="w-4 h-4" />,
        count: reconciliations.length,
        content: (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" loading={reconciling} leftIcon={<RefreshCw className="w-4 h-4" />} onClick={handleReconcile}>
                Snapshot Reconciliation
              </Button>
            </div>
            <DataGrid columns={reconColumns} rows={reconciliations} loading={loadingLedger} getRowId={(r) => r.id}
              emptyTitle="No reconciliations saved" emptyHint="Pick a branch and set a period, then snapshot to lock in the figures." />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchases, readings, fills, reconciliations, loadingLedger, reconciling],
  );

  return (
    <DashboardLayout title="Gas & Tanks" subtitle="Mass-balance accountability across your branches">
      <div className="space-y-6">
        <PageHeader
          title="Gas Mass-Balance"
          description="Checkmate everything: what you bought, what you dispensed, and what should remain."
          icon={<Flame className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <ExportMenu kind="gas-balance" filters={{ branchId, from, to }} />
              <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() =>
                exportCsv(
                  `gas-purchases-${branchId || "all"}.csv`,
                  purchases.map((p) => ({
                    Supplier: p.supplierName,
                    Branch: p.branchName,
                    Date: fmtDate(p.purchaseDate),
                    "Volume (kg)": p.volumeKg,
                    "Unit Cost": p.unitCost,
                    "Total Cost": p.totalCost,
                    Notes: p.notes ?? "",
                  })),
                )
              }
            >
              Export Purchases
            </Button>
            </div>
          }
        />

        {/* Filters */}
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to || branchId) && (
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => { setBranchId(""); setFrom(""); setTo(""); }}>
                Clear filters
              </Button>
            </div>
          )}
        </Card>

        {/* Balance tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Boxes className="w-5 h-5" />} label="Opening Stock" value={kg(balance?.openingKg ?? 0)} accent="blue" loading={loadingBalance} />
          <StatTile icon={<TrendingUp className="w-5 h-5" />} label="Purchased (In)" value={kg(balance?.purchasesKg ?? 0)} accent="green" loading={loadingBalance} />
          <StatTile icon={<TrendingDown className="w-5 h-5" />} label="Dispensed (Out)" value={kg(balance?.dispensedKg ?? 0)} accent="amber" loading={loadingBalance} />
          <StatTile icon={<Gauge className="w-5 h-5" />} label="Current On-Hand" value={kg(balance?.currentOnHandKg ?? 0)} accent="navy" loading={loadingBalance} />
        </div>

        {/* Expected vs actual + variance */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expected Closing</p>
                <p className="text-2xl font-bold text-navy-900">
                  {loadingBalance ? "—" : kg(balance?.expectedClosingKg ?? 0)}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Opening + Purchased − Dispensed</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Actual Closing</p>
                <p className="text-2xl font-bold text-navy-900">
                  {loadingBalance ? "—" : balance?.hasActual ? kg(balance.actualClosingKg) : "No reading"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-500">
                <Gauge className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Latest tank gauge within the period</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Variance / Shrinkage</p>
                <p className={`text-2xl font-bold ${balance && balance.varianceKg < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {loadingBalance ? "—" : `${balance && balance.varianceKg > 0 ? "+" : ""}${kg(balance?.varianceKg ?? 0)}`}
                </p>
              </div>
              <Badge tone={statusMeta.tone} dot>{statusMeta.label}</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {balance?.hasActual
                ? `${balance.variancePct}% vs expected · shrinkage ${kg(balance?.shrinkageKg ?? 0)}`
                : "Add a tank reading to compute variance"}
            </p>
          </Card>
        </div>

        {/* How it works */}
        <Card>
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-navy-900">How this keeps you honest</p>
              <p className="mt-1 leading-relaxed">
                Gas is measured in kilograms; bulk tanks are gauged in litres (converted at 0.54 kg/L). We start from the
                tank level before the period, add what you <em>bought</em>, subtract what you <em>dispensed into cylinders</em>,
                and get the <strong>expected</strong> amount still in the tank. Comparing that to the <strong>actual</strong> gauge
                reading exposes any <strong>shrinkage</strong> — gas that went out without a matching record.
              </p>
            </div>
          </div>
        </Card>

        {/* Ledgers */}
        <Card>
          <Tabs items={tabs} />
        </Card>
      </div>

      {/* Purchase modal */}
      <Modal
        open={purchaseModal}
        onClose={() => setPurchaseModal(false)}
        title="Record Gas Purchase"
        description="Stock-in: gas bought from a supplier into a branch."
        footer={
          <>
            <Button variant="outline" onClick={() => setPurchaseModal(false)}>Cancel</Button>
            <Button type="submit" form="purchase-form" disabled={!pForm.branchId || !pForm.supplierName || !pForm.volumeKg}>
              Save Purchase
            </Button>
          </>
        }
      >
        <form id="purchase-form" onSubmit={submitPurchase} className="space-y-4">
          <Select label="Branch" value={pForm.branchId} onChange={(e) => setPForm({ ...pForm, branchId: e.target.value })} required>
            <option value="">Select branch</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </Select>
          <Input label="Supplier" value={pForm.supplierName} onChange={(e) => setPForm({ ...pForm, supplierName: e.target.value })} required placeholder="e.g. NG Bulk LPG" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label="Purchase Date" value={pForm.purchaseDate} onChange={(e) => setPForm({ ...pForm, purchaseDate: e.target.value })} required />
            <Input type="number" step="0.001" label="Volume (kg)" value={pForm.volumeKg} onChange={(e) => setPForm({ ...pForm, volumeKg: e.target.value })} required placeholder="e.g. 12000" />
          </div>
          <Input type="number" step="0.01" label="Unit Cost (₦/kg, optional)" value={pForm.unitCost} onChange={(e) => setPForm({ ...pForm, unitCost: e.target.value })} placeholder="Landed cost per kg" hint="Total cost is calculated automatically from volume × unit cost." />
          <Input label="Notes (optional)" value={pForm.notes} onChange={(e) => setPForm({ ...pForm, notes: e.target.value })} placeholder="Waybill number, remarks…" />
        </form>
      </Modal>

      {/* Reading modal */}
      <Modal
        open={readingModal}
        onClose={() => setReadingModal(false)}
        title="Add Tank Reading"
        description="A physical gauge measurement of a bulk tank, in litres."
        footer={
          <>
            <Button variant="outline" onClick={() => setReadingModal(false)}>Cancel</Button>
            <Button type="submit" form="reading-form" disabled={!rForm.branchId || !rForm.volumeLiters}>
              Save Reading
            </Button>
          </>
        }
      >
        <form id="reading-form" onSubmit={submitReading} className="space-y-4">
          <Select label="Branch" value={rForm.branchId} onChange={(e) => setRForm({ ...rForm, branchId: e.target.value, bulkStorageId: "" })} required>
            <option value="">Select branch</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </Select>
          <Select label="Tank (optional)" value={rForm.bulkStorageId} onChange={(e) => setRForm({ ...rForm, bulkStorageId: e.target.value })} hint={rForm.branchId && tanks.length === 0 ? "No bulk tanks registered for this branch." : undefined}>
            <option value="">Unspecified / aggregate</option>
            {tanks.map((t) => (<option key={t.id} value={t.id}>{t.tankName}</option>))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="datetime-local" label="Read At" value={rForm.readAt} onChange={(e) => setRForm({ ...rForm, readAt: e.target.value })} required />
            <Input type="number" step="0.001" label="Volume (litres)" value={rForm.volumeLiters} onChange={(e) => setRForm({ ...rForm, volumeLiters: e.target.value })} required placeholder="e.g. 22000" />
          </div>
          <Input label="Note (optional)" value={rForm.note} onChange={(e) => setRForm({ ...rForm, note: e.target.value })} placeholder="e.g. dipstick reading, gauge #2" />
        </form>
      </Modal>

      {/* Fill modal */}
      <Modal
        open={fillModal}
        onClose={() => setFillModal(false)}
        title="Record Cylinder Fill"
        description="Gas dispensed into a cylinder — this is outflow."
        footer={
          <>
            <Button variant="outline" onClick={() => setFillModal(false)}>Cancel</Button>
            <Button type="submit" form="fill-form" disabled={!fForm.branchId || !fForm.cylinderId || !fForm.filledKg}>
              Save Fill
            </Button>
          </>
        }
      >
        <form id="fill-form" onSubmit={submitFill} className="space-y-4">
          <Select label="Branch" value={fForm.branchId} onChange={(e) => setFForm({ ...fForm, branchId: e.target.value, cylinderId: "" })} required>
            <option value="">Select branch</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </Select>
          <Select label="Cylinder" value={fForm.cylinderId} onChange={(e) => setFForm({ ...fForm, cylinderId: e.target.value })} required hint={fForm.branchId && cylinders.length === 0 ? "No cylinders registered for this branch yet." : undefined}>
            <option value="">Select cylinder</option>
            {cylinders.map((c) => (<option key={c.id} value={c.id}>{c.serialNumber} ({c.sizeKg}kg)</option>))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="datetime-local" label="Filled At" value={fForm.filledAt} onChange={(e) => setFForm({ ...fForm, filledAt: e.target.value })} required />
            <Input type="number" step="0.001" label="Gas Filled (kg)" value={fForm.filledKg} onChange={(e) => setFForm({ ...fForm, filledKg: e.target.value })} required placeholder="e.g. 14.5" />
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
