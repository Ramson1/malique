"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, ShoppingCart, CheckCircle2, Truck, Cog, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  DataGrid,
  FilterBar,
  PageHeader,
  useToast,
  type Column,
  type FilterField,
  ExportMenu,
  Input,
  Select,
  Modal,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { downloadReport } from "@/lib/export";
import { useCan } from "@/lib/auth-context";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: string;
  branchName: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_TONE: Record<
  string,
  "amber" | "blue" | "purple" | "green" | "red" | "neutral"
> = {
  pending: "amber",
  confirmed: "blue",
  processing: "purple",
  delivering: "purple",
  delivered: "green",
  cancelled: "red",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Counter-sale payment channels, matching POS_PAYMENT_METHODS on the server.
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank Transfer" },
  { value: "pos", label: "Card Terminal (POS)" },
];

type OrderLine = { productId: string; sizeKg: string; quantity: string };

interface ProductLite {
  id: string;
  name: string;
  sizes: number[];
}

function OrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: searchParams.get("status") || "",
    search: "",
  });
  const [committedSearch, setCommittedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // New order (manual counter sale) state — mirrors @Roles on POST /admin/orders.
  const canCreate = useCan("super_admin", "admin", "branch_manager", "staff");
  const [showOrder, setShowOrder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [orderForm, setOrderForm] = useState({
    branchId: "",
    customerName: "",
    customerPhone: "",
    paymentMethod: "cash",
  });
  const [lines, setLines] = useState<OrderLine[]>([{ productId: "", sizeKg: "", quantity: "1" }]);

  useEffect(() => {
    if (!canCreate) return;
    api
      .get<{ products: ProductLite[] }>("/admin/products")
      .then((d) =>
        setProducts((d.products ?? []).filter((p) => p.sizes?.length).map((p) => ({ id: p.id, name: p.name, sizes: p.sizes }))),
      )
      .catch(() => setProducts([]));
    api
      .get<{ branches: { id: string; name: string }[] }>("/admin/branches")
      .then((d) => setBranches(d.branches ?? []))
      .catch(() => setBranches([]));
  }, [canCreate]);

  function openNewOrder() {
    setOrderForm({ branchId: "", customerName: "", customerPhone: "", paymentMethod: "cash" });
    setLines([{ productId: "", sizeKg: "", quantity: "1" }]);
    setShowOrder(true);
  }

  function updateLine(index: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", sizeKg: "", quantity: "1" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.productId && l.sizeKg)
      .map((l) => ({
        productId: l.productId,
        sizeKg: Number(l.sizeKg),
        quantity: Math.max(1, Number(l.quantity) || 1),
      }));
    if (!orderForm.branchId) {
      toast.error("Select a branch for this order.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one product line.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/orders", {
        branchId: orderForm.branchId || undefined,
        customerName: orderForm.customerName || undefined,
        customerPhone: orderForm.customerPhone || undefined,
        paymentMethod: orderForm.paymentMethod,
        items,
      });
      toast.success("Order created");
      setShowOrder(false);
      setCurrentPage(1);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create order. Check stock levels and try again.");
    } finally {
      setSaving(false);
    }
  }


  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (committedSearch) params.set("search", committedSearch);
      params.set("page", String(currentPage));
      params.set("limit", "20");
      const data = await api.get<OrdersResponse>(`/admin/orders?${params.toString()}`);
      setOrders(data.orders ?? []);
      setTotalPages(data.totalPages ?? 1);
      setSelected(new Set());
    } catch {
      toast.error("Could not load orders. Please retry.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, committedSearch, currentPage]);

  useEffect(() => {
    const id = setTimeout(() => {
      setCommittedSearch(filters.search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function updateStatus(orderId: string, newStatus: string) {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      toast.success("Order status updated");
    } catch {
      toast.error("Failed to update order status.");
    }
  }

  const selectedIds = useMemo(() => [...selected], [selected]);

  const filterFields: FilterField[] = [
    { key: "search", type: "search", placeholder: "Search by order number or customer…" },
    {
      key: "status",
      type: "select",
      label: "All Status",
      options: [
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "processing", label: "Processing" },
        { value: "delivering", label: "Delivering" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
  ];

  const columns: Column<Order>[] = [
    {
      key: "order",
      header: "Order",
      sortable: true,
      sortValue: (r) => r.orderNumber,
      render: (o) => (
        <span className="text-sm font-medium text-navy-900">{o.orderNumber}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{o.customerName}</p>
          <p className="text-xs text-slate-500">{o.customerPhone}</p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (o) => <span className="text-sm text-slate-500">{o.branchName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (o) => (
        <span className="text-sm font-medium text-slate-700">
          {formatCurrency(o.total)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <Badge tone={STATUS_TONE[o.status] ?? "neutral"} dot>
          <span className="capitalize">{o.status}</span>
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
      render: (o) => <span className="text-sm text-slate-500">{formatDate(o.createdAt)}</span>,
    },
  ];

  return (
    <DashboardLayout title="Orders" subtitle="Manage and track all customer orders">
      <div className="space-y-6">
        <PageHeader
          title="Orders"
          description="Every order captured across your branches, from pending to delivered."
          icon={<ShoppingCart className="w-5 h-5" />}
          actions={
            canCreate ? (
              <Button onClick={openNewOrder} leftIcon={<Plus className="w-4 h-4" />}>
                New Order
              </Button>
            ) : undefined
          }
        />

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
            setCurrentPage(1);
          }}
          onReset={() => setFilters({ status: "", search: "" })}
          right={
            <ExportMenu
              kind="orders"
              filters={{ status: filters.status, search: committedSearch }}
              onPick={
                selectedIds.length > 0
                  ? (format) =>
                      downloadReport("orders", format, {
                        status: filters.status,
                        search: committedSearch,
                        ids: selectedIds.join(","),
                      })
                  : undefined
              }
            />
          }
        />

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span>
              <strong>{selectedIds.length}</strong> order{selectedIds.length > 1 ? "s" : ""} selected —
              Export will cover only the selected rows.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        )}

        <DataGrid
          columns={columns}
          rows={orders}
          loading={loading}
          getRowId={(r) => r.id}
          selectable
          selectedIds={selected}
          onSelectionChange={(ids) => setSelected(new Set(ids))}
          onRowClick={(o) => router.push(`/dashboard/orders/${o.id}`)}
          emptyTitle="No orders found"
          emptyHint="Adjust your filters, or new orders will appear here as customers order."
          rowActions={(o) => (
            <div className="inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                aria-label="View details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {o.status === "pending" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus(o.id, "confirmed")}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  Confirm
                </Button>
              )}
              {o.status === "confirmed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus(o.id, "processing")}
                  leftIcon={<Cog className="w-3.5 h-3.5" />}
                >
                  Process
                </Button>
              )}
              {o.status === "processing" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus(o.id, "delivering")}
                  leftIcon={<Truck className="w-3.5 h-3.5" />}
                >
                  Deliver
                </Button>
              )}
            </div>
          )}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 text-sm text-slate-500">
            <p>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showOrder}
        onClose={() => setShowOrder(false)}
        title="New Order"
        description="Record a counter/phone order for a customer. Stock is deducted from the selected branch."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowOrder(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-order-form" loading={saving}>
              Create Order
            </Button>
          </>
        }
      >
        <form id="new-order-form" onSubmit={handleCreateOrder} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Branch"
              value={orderForm.branchId}
              onChange={(e) => setOrderForm((f) => ({ ...f, branchId: e.target.value }))}
              required
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              label="Payment Method"
              value={orderForm.paymentMethod}
              onChange={(e) => setOrderForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              required
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input
              label="Customer Name (optional)"
              value={orderForm.customerName}
              onChange={(e) => setOrderForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="Walk-in or registered name"
            />
            <Input
              label="Customer Phone (optional)"
              value={orderForm.customerPhone}
              onChange={(e) => setOrderForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="Matches a registered customer if found"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-navy-800">Items</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add line
              </Button>
            </div>
            {lines.map((line, i) => {
              const product = products.find((p) => p.id === line.productId);
              return (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? "Product" : undefined}
                      value={line.productId}
                      onChange={(e) =>
                        updateLine(i, { productId: e.target.value, sizeKg: "" })
                      }
                      required
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28">
                    <Select
                      label={i === 0 ? "Size" : undefined}
                      value={line.sizeKg}
                      onChange={(e) => updateLine(i, { sizeKg: e.target.value })}
                      disabled={!product}
                      required
                    >
                      <option value="">Size</option>
                      {(product?.sizes ?? []).map((s) => (
                        <option key={s} value={String(s)}>
                          {s}kg
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      label={i === 0 ? "Qty" : undefined}
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersInner />
    </Suspense>
  );
}
