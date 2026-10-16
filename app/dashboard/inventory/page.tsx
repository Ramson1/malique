"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Package,
  PackageCheck,
  AlertTriangle,
  PackageX,
  ArrowUpDown,
  Minus,
  Plus,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Modal,
  DataGrid,
  FilterBar,
  PageHeader,
  StatTile,
  useToast,
  type Column,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface InventoryItem {
  id: string;
  productName: string;
  branchName: string;
  branchId: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  status: string;
  lastRestocked: string;
}

const STATUS_META: Record<
  string,
  { label: string; tone: "green" | "amber" | "red" | "slate" }
> = {
  in_stock: { label: "In Stock", tone: "green" },
  low: { label: "Low", tone: "amber" },
  critical: { label: "Critical", tone: "red" },
  out_of_stock: { label: "Out of Stock", tone: "red" },
};

const REASONS = [
  { value: "restock", label: "Restock" },
  { value: "damaged", label: "Damaged" },
  { value: "returned", label: "Returned" },
  { value: "correction", label: "Correction" },
];

function barColor(status: string): string {
  switch (status) {
    case "critical":
      return "bg-red-500";
    case "low":
      return "bg-amber-500";
    case "out_of_stock":
      return "bg-red-600";
    default:
      return "bg-emerald-500";
  }
}

export default function InventoryPage() {
  const toast = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    branch: "",
    status: "",
  });
  const [adjustModal, setAdjustModal] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  useEffect(() => {
    async function fetchInventory() {
      try {
        const data = await api.get<{ inventory: InventoryItem[] }>("/admin/inventory");
        setInventory(data.inventory ?? []);
      } catch {
        toast.error("Could not load inventory. Please retry.");
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchOptions = useMemo(
    () =>
      Array.from(new Set(inventory.map((i) => i.branchName))).map((b) => ({
        value: b,
        label: b,
      })),
    [inventory],
  );

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search products or branches…" },
      { key: "branch", type: "select", label: "All Branches", options: branchOptions },
      {
        key: "status",
        type: "select",
        label: "All Status",
        options: Object.entries(STATUS_META).map(([value, m]) => ({
          value,
          label: m.label,
        })),
      },
    ],
    [branchOptions],
  );

  const filtered = inventory.filter((item) => {
    const q = filters.search.toLowerCase();
    const matchSearch =
      !q ||
      item.productName.toLowerCase().includes(q) ||
      item.branchName.toLowerCase().includes(q);
    const matchBranch = !filters.branch || item.branchName === filters.branch;
    const matchStatus = !filters.status || item.status === filters.status;
    return matchSearch && matchBranch && matchStatus;
  });

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustModal) return;
    try {
      await api.post("/admin/inventory/adjust", {
        inventoryId: adjustModal.id,
        quantity: adjustQty,
        reason: adjustReason,
      });
      setInventory((prev) =>
        prev.map((i) =>
          i.id === adjustModal.id
            ? {
                ...i,
                currentStock: Math.max(0, i.currentStock + adjustQty),
              }
            : i,
        ),
      );
      toast.success("Stock adjusted");
      setAdjustModal(null);
      setAdjustQty(0);
      setAdjustReason("");
    } catch {
      toast.error("Failed to adjust stock.");
    }
  }

  const columns: Column<InventoryItem>[] = [
    {
      key: "product",
      header: "Product",
      sortable: true,
      sortValue: (r) => r.productName,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-navy-900">{item.productName}</span>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      sortValue: (r) => r.branchName,
      render: (item) => <span className="text-sm text-slate-500">{item.branchName}</span>,
    },
    {
      key: "stock",
      header: "Stock Level",
      sortable: true,
      sortValue: (r) => r.currentStock,
      render: (item) => {
        const pct = Math.min((item.currentStock / item.maxStock) * 100, 100);
        return (
          <div className="flex items-center gap-3">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${barColor(item.status)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-slate-700">
              {item.currentStock} / {item.maxStock}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (item) => {
        const meta = STATUS_META[item.status] ?? {
          label: item.status,
          tone: "slate" as const,
        };
        return (
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <DashboardLayout title="Inventory" subtitle="Monitor stock levels across all branches">
      <div className="space-y-6">
        <PageHeader
          title="Inventory Overview"
          description="Live stock levels and restock health across your Rivers State branches."
          icon={<Boxes className="w-5 h-5" />}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={<Boxes className="w-5 h-5" />}
            label="Total Items"
            value={inventory.length}
            accent="navy"
          />
          <StatTile
            icon={<PackageCheck className="w-5 h-5" />}
            label="In Stock"
            value={inventory.filter((i) => i.status === "in_stock").length}
            accent="green"
          />
          <StatTile
            icon={<AlertTriangle className="w-5 h-5" />}
            label="Low / Critical"
            value={
              inventory.filter((i) => i.status === "low" || i.status === "critical")
                .length
            }
            accent="amber"
          />
          <StatTile
            icon={<PackageX className="w-5 h-5" />}
            label="Out of Stock"
            value={inventory.filter((i) => i.status === "out_of_stock").length}
            accent="red"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", branch: "", status: "" })}
          right={
            <ExportMenu
              kind="inventory"
              filters={{ search: filters.search, status: filters.status, branchId: filters.branch }}
            />
          }
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => r.id}
          emptyTitle="No stock items found"
          emptyHint="Adjust your filters, or add inventory to your branches."
          rowActions={(item) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdjustModal(item);
                setAdjustQty(0);
                setAdjustReason("");
              }}
              leftIcon={<ArrowUpDown className="w-3.5 h-3.5" />}
            >
              Adjust
            </Button>
          )}
        />
      </div>

      <Modal
        open={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title="Adjust Stock"
        description={
          adjustModal
            ? `${adjustModal.productName} — ${adjustModal.branchName}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="adjust-form" disabled={!adjustReason}>
              Apply Adjustment
            </Button>
          </>
        }
      >
        {adjustModal && (
          <form id="adjust-form" onSubmit={handleAdjust} className="space-y-4">
            <Input
              label="Current Stock"
              value={String(adjustModal.currentStock)}
              readOnly
              disabled
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-800">
                Adjustment
              </label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustQty((q) => q - 1)}
                  aria-label="Decrease"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustQty((q) => q + 1)}
                  aria-label="Increase"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                New total: {Math.max(0, adjustModal.currentStock + adjustQty)} · use
                negative values to reduce stock
              </p>
            </div>
            <Select
              label="Reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
            >
              <option value="">Select reason</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
