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
  PencilLine,
  Trash2,
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
import { useCan } from "@/lib/auth-context";

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

// Create/edit a branch stock row. `id` present => edit (PATCH thresholds/stock);
// absent => create a new row (POST). Product/branch/size only settable on create.
type StockForm = {
  id?: string;
  productId: string;
  branchId: string;
  sizeKg: string;
  currentStock: string;
  minStock: string;
  maxStock: string;
};

const emptyStockForm: StockForm = {
  productId: "",
  branchId: "",
  sizeKg: "",
  currentStock: "0",
  minStock: "5",
  maxStock: "500",
};

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
  // Mirrors @Roles('super_admin','admin','branch_manager') on inventory writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
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

  // Create/edit stock-row state + catalog options for the create form.
  const [stockOpen, setStockOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stockForm, setStockForm] = useState<StockForm>(emptyStockForm);
  const [productOptions, setProductOptions] = useState<
    { id: string; name: string; sizes: number[] }[]
  >([]);
  const [branchOptions2, setBranchOptions2] = useState<{ id: string; name: string }[]>([]);

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

  useEffect(() => {
    fetchInventory();
    api
      .get<{ products: { id: string; name: string; sizes: number[] }[] }>("/admin/products")
      .then((d) =>
        setProductOptions(
          (d.products ?? [])
            .filter((p) => (p.sizes?.length ?? 0) > 0)
            .map((p) => ({ id: p.id, name: p.name, sizes: p.sizes })),
        ),
      )
      .catch(() => setProductOptions([]));
    api
      .get<{ branches: { id: string; name: string }[] }>("/admin/branches")
      .then((d) => setBranchOptions2(d.branches ?? []))
      .catch(() => setBranchOptions2([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAddStock() {
    setEditingId(null);
    setStockForm(emptyStockForm);
    setStockOpen(true);
  }

  function openEditStock(item: InventoryItem) {
    setEditingId(item.id);
    setStockForm({
      currentStock: String(item.currentStock),
      minStock: String(item.minStock),
      maxStock: String(item.maxStock),
      productId: "",
      branchId: item.branchId,
      sizeKg: "",
    });
    setStockOpen(true);
  }

  async function handleSaveStock(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api.patch<{
          currentStock: number;
          minStock: number;
          maxStock: number;
          status: string;
        }>(`/admin/inventory/items/${editingId}`, {
          currentStock: Number(stockForm.currentStock) || 0,
          minStockLevel: Number(stockForm.minStock) || 0,
          maxCapacity: Number(stockForm.maxStock) || 1,
        });
        setInventory((prev) =>
          prev.map((i) =>
            i.id === editingId
              ? {
                  ...i,
                  currentStock: updated.currentStock,
                  minStock: updated.minStock,
                  maxStock: updated.maxStock,
                  status: updated.status,
                }
              : i,
          ),
        );
        toast.success("Stock row updated");
      } else {
        await api.post("/admin/inventory/items", {
          productId: stockForm.productId,
          branchId: stockForm.branchId,
          sizeKg: Number(stockForm.sizeKg) || 0,
          quantityOnHand: Number(stockForm.currentStock) || 0,
          minStockLevel: Number(stockForm.minStock) || 0,
          maxCapacity: Number(stockForm.maxStock) || 1,
        });
        toast.success("Stock row added");
        await fetchInventory();
      }
      setStockOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save stock row.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStock(item: InventoryItem) {
    if (!window.confirm(`Delete ${item.productName} stock at ${item.branchName}?`)) return;
    try {
      await api.delete(`/admin/inventory/items/${item.id}`);
      setInventory((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Stock row deleted");
    } catch (err: any) {
      toast.error(err?.message || "Could not delete stock row.");
    }
  }


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
          actions={
            canManage ? (
              <Button onClick={openAddStock} leftIcon={<Plus className="w-4 h-4" />}>
                Add Stock
              </Button>
            ) : undefined
          }
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
            <div className="inline-flex items-center gap-1">
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
              {canManage && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditStock(item)}
                    aria-label="Edit stock"
                  >
                    <PencilLine className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteStock(item)}
                    aria-label="Delete stock row"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
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

      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title={editingId ? "Edit Stock Row" : "Add Stock Row"}
        description={
          editingId
            ? "Update the on-hand quantity or restock thresholds for this branch."
            : "Create a new branch stock record for a product size."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStockOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="stock-form" loading={saving}>
              {editingId ? "Save Changes" : "Add Stock"}
            </Button>
          </>
        }
      >
        <form id="stock-form" onSubmit={handleSaveStock} className="space-y-4">
          {!editingId && (
            <>
              <Select
                label="Product"
                value={stockForm.productId}
                onChange={(e) =>
                  setStockForm((f) => ({ ...f, productId: e.target.value, sizeKg: "" }))
                }
                required
              >
                <option value="">Select product</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Branch"
                value={stockForm.branchId}
                onChange={(e) => setStockForm((f) => ({ ...f, branchId: e.target.value }))}
                required
              >
                <option value="">Select branch</option>
                {branchOptions2.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Cylinder Size"
                value={stockForm.sizeKg}
                onChange={(e) => setStockForm((f) => ({ ...f, sizeKg: e.target.value }))}
                required
                disabled={!stockForm.productId}
              >
                <option value="">
                  {stockForm.productId ? "Select size" : "Pick a product first"}
                </option>
                {(productOptions.find((p) => p.id === stockForm.productId)?.sizes ?? []).map(
                  (s) => (
                    <option key={s} value={String(s)}>
                      {s}kg
                    </option>
                  ),
                )}
              </Select>
            </>
          )}
          <Input
            label={editingId ? "Current Stock" : "Initial Stock"}
            type="number"
            min={0}
            value={stockForm.currentStock}
            onChange={(e) => setStockForm((f) => ({ ...f, currentStock: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min Stock Level"
              type="number"
              min={0}
              value={stockForm.minStock}
              onChange={(e) => setStockForm((f) => ({ ...f, minStock: e.target.value }))}
              required
            />
            <Input
              label="Max Capacity"
              type="number"
              min={1}
              value={stockForm.maxStock}
              onChange={(e) => setStockForm((f) => ({ ...f, maxStock: e.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
