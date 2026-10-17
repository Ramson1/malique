"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, PencilLine, Package, Tags, ClipboardCheck } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Badge,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  FilterBar,
  PageHeader,
  useToast,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/auth-context";

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  weight?: string;
  sizes?: number[];
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
}

type PriceEntry = { sizeKg: number; price: string };

// A secretary-submitted change awaiting admin review (GET /product-changes/pending).
interface ChangeRequest {
  id: string;
  type: string; // create | edit | price
  productId: string | null;
  productName: string | null;
  requestedBy: string | null;
  createdAt: string;
  proposal: Record<string, any>;
  current: Record<string, any> | null;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  create: "New product",
  edit: "Product edit",
  price: "Price change",
};

// Accepts UI tokens ("cylinder-refill") and raw DB enums ("refill") — queued
// `current` snapshots use the UI tokens, stale/other payloads may not.
function catLabel(value?: string): string {
  if (!value) return "—";
  return (
    CATEGORY_LABELS[value] ??
    CATEGORY_LABELS[value.replace(/_/g, "-")] ??
    value
  );
}

function requestRows(r: ChangeRequest): { label: string; from: string; to: string }[] {
  const cur = r.current ?? {};
  const p = r.proposal ?? {};
  if (r.type === "price") {
    const entries = Array.isArray(p.entries) ? p.entries : [];
    const rows = entries.map((en: any) => ({
      label: `${Number(en.sizeKg) === 0 ? "Flat" : `${Number(en.sizeKg)}kg`} price`,
      from: cur.price !== undefined ? formatCurrency(Number(cur.price)) : "—",
      to: formatCurrency(Number(en.price)),
    }));
    rows.push({
      label: "Scope",
      from: "—",
      to: p.allBranches ? "All branches" : "One branch",
    });
    return rows;
  }
  const rows: { label: string; from: string; to: string }[] = [];
  if (p.name !== undefined)
    rows.push({ label: "Name", from: String(cur.name ?? "—"), to: String(p.name) });
  if (p.category !== undefined)
    rows.push({ label: "Category", from: catLabel(cur.category), to: catLabel(p.category) });
  if (p.price !== undefined)
    rows.push({
      label: "Price",
      from: cur.price !== undefined ? formatCurrency(Number(cur.price)) : "—",
      to: formatCurrency(Number(p.price)),
    });
  if (p.weight !== undefined)
    rows.push({
      label: "Size (kg)",
      from: cur.weight !== undefined && cur.weight !== null ? `${cur.weight}kg` : "—",
      to: `${p.weight}kg`,
    });
  if (p.description !== undefined)
    rows.push({ label: "Description", from: String(cur.description ?? "—"), to: String(p.description) });
  return rows;
}

const CATEGORY_LABELS: Record<string, string> = {
  "cylinder-refill": "Cylinder Refill",
  "new-cylinder": "New Cylinder",
  accessory: "Accessory",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

type FormState = {
  name: string;
  description: string;
  category: string;
  price: string;
  weight: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "cylinder-refill",
  price: "",
  weight: "",
};

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProductIds, setPendingProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    category: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Mirrors @Roles('super_admin','admin','branch_manager') on the product BFF writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
  // Mirrors @Roles('super_admin','admin') on the approval review endpoints.
  const canApprove = useCan("super_admin", "admin");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Approval queue state (secretary-submitted product changes).
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [reviewing, setReviewing] = useState<ChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  // Global price control modal state.
  const [showPrices, setShowPrices] = useState(false);
  const [pricesProduct, setPricesProduct] = useState<Product | null>(null);
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([]);
  const [priceScope, setPriceScope] = useState<string>("all"); // "all" or a branchId
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pricesSaving, setPricesSaving] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await api.get<{
          products: Product[];
          pendingProductIds?: string[];
        }>("/admin/products");
        setProducts(data.products ?? []);
        setPendingProductIds(data.pendingProductIds ?? []);
      } catch {
        toast.error("Could not load products. Please retry.");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPending = useMemo(
    () => async () => {
      try {
        const data = await api.get<{ requests: ChangeRequest[] }>(
          "/product-changes/pending",
        );
        setPendingRequests(data.requests ?? []);
      } catch {
        // Queue is non-critical for the grid view; stay silent and retry
        // whenever the page or an action refetches.
      }
    },
    [],
  );

  useEffect(() => {
    if (canApprove) loadPending();
  }, [canApprove, loadPending]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search products…" },
      {
        key: "category",
        type: "select",
        label: "All Categories",
        options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
    ],
    [],
  );

  const filtered = products.filter((p) => {
    const q = filters.search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    const matchesCategory = !filters.category || p.category === filters.category;
    return matchesSearch && matchesCategory;
  });

  function openAddModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      weight: product.weight || "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) };
      if (editingProduct) {
        await api.patch(`/admin/products/${editingProduct.id}`, payload);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id ? { ...p, ...payload } : p,
          ),
        );
        toast.success("Product updated");
      } else {
        const created = await api.post<Product>("/admin/products", payload);
        setProducts((prev) => [...prev, created]);
        toast.success("Product created");
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save product. Please check the details.");
    } finally {
      setSaving(false);
    }
  }

  function openReview(req: ChangeRequest) {
    setReviewing(req);
    setRejectReason("");
  }

  async function handleApprove() {
    if (!reviewing) return;
    setReviewBusy(true);
    try {
      await api.post(`/product-changes/${reviewing.id}/approve`, {});
      toast.success("Change approved — live across the system now.");
      setReviewing(null);
      await loadPending();
      const data = await api.get<{
        products: Product[];
        pendingProductIds?: string[];
      }>("/admin/products");
      setProducts(data.products ?? []);
      setPendingProductIds(data.pendingProductIds ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve the change.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function handleReject() {
    if (!reviewing) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Give a reason (3+ characters) so the secretary can fix it.");
      return;
    }
    setReviewBusy(true);
    try {
      await api.post(`/product-changes/${reviewing.id}/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success("Change rejected — the secretary can see your reason.");
      setReviewing(null);
      await loadPending();
      const data = await api.get<{
        products: Product[];
        pendingProductIds?: string[];
      }>("/admin/products");
      setProducts(data.products ?? []);
      setPendingProductIds(data.pendingProductIds ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject the change.");
    } finally {
      setReviewBusy(false);
    }
  }

  function openPricesModal(product: Product) {
    setPricesProduct(product);
    setPriceScope("all");
    const sizes =
      product.sizes && product.sizes.length ? product.sizes.map(Number) : [0];
    const primary = sizes[0] || 0;
    const kgBased =
      product.category === "cylinder-refill" ||
      product.category === "new-cylinder";
    setPriceEntries(
      sizes.map((sizeKg) => ({
        sizeKg,
        price: String(
          kgBased && primary > 0
            ? Math.round((product.price * sizeKg) / primary)
            : product.price,
        ),
      })),
    );
    setShowPrices(true);
    if (!branches.length) {
      api
        .get<{ branches: Branch[] }>("/admin/branches")
        .then((data) => setBranches(data.branches ?? []))
        .catch(() => undefined);
    }
  }

  async function handleSavePrices(e: React.FormEvent) {
    e.preventDefault();
    if (!pricesProduct) return;
    const entries = priceEntries
      .map((en) => ({ sizeKg: Number(en.sizeKg), price: Number(en.price) }))
      .filter(
        (en) =>
          Number.isFinite(en.sizeKg) &&
          en.sizeKg >= 0 &&
          Number.isFinite(en.price) &&
          en.price >= 0,
      );
    if (!entries.length) {
      toast.error("Enter at least one valid price.");
      return;
    }
    if (priceScope !== "all" && !priceScope) {
      toast.error("Pick a branch or apply to all branches.");
      return;
    }
    setPricesSaving(true);
    try {
      await api.put(`/admin/products/${pricesProduct.id}/prices`, {
        entries,
        ...(priceScope === "all"
          ? { allBranches: true }
          : { branchId: priceScope }),
      });
      toast.success("Prices updated — live on the website and POS now.");
      setShowPrices(false);
    } catch {
      toast.error("Failed to save prices. Please check the values.");
    } finally {
      setPricesSaving(false);
    }
  }

  return (
    <DashboardLayout title="Products" subtitle="Manage your product catalog">
      <div className="space-y-6">
        <PageHeader
          title="Product Catalog"
          description="Every cylinder, refill and accessory available across your branches."
          icon={<Package className="w-5 h-5" />}
          actions={
            canManage ? (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                Add Product
              </Button>
            ) : undefined
          }
        />

        {canApprove && pendingRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-navy-900">
                  Awaiting Approval
                </h3>
                <p className="text-xs text-slate-500">
                  Changes submitted from the secretary portal go live only
                  after you approve them.
                </p>
              </div>
              <Badge tone="amber" className="ml-auto">{pendingRequests.length} pending</Badge>
            </div>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-100 bg-white px-3 py-2"
                >
                  <Badge tone="amber">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</Badge>
                  <span className="text-sm font-medium text-navy-900">
                    {req.productName ?? req.proposal?.name ?? "(unknown product)"}
                  </span>
                  <span className="text-xs text-slate-500">
                    by {req.requestedBy ?? "secretary"} ·{" "}
                    {new Date(req.createdAt).toLocaleString()}
                  </span>
                  {!req.current && req.type !== "create" && (
                    <Badge tone="red">Product deleted</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => openReview(req)}
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={setFilter}
          onReset={() => setFilters({ search: "", category: "" })}
          right={<ExportMenu kind="products" filters={{ search: filters.search, category: filters.category }} />}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-slate-100" />
                <div className="mt-3 h-3.5 w-3/4 rounded bg-slate-100" />
                <div className="mt-2 h-3 w-full rounded bg-slate-100" />
                <div className="mt-4 h-5 w-1/2 rounded bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-navy-900">No products found</p>
            <p className="max-w-sm text-xs text-slate-500">
              Try adjusting your search, or add a new product to your catalog.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <Card key={product.id} hover className="flex flex-col">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={product.isActive ? "green" : "slate"} dot>
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {pendingProductIds.includes(product.id) && (
                      <Badge tone="amber">Pending change</Badge>
                    )}
                  </div>
                </div>
                <h3 className="mb-1 text-sm font-semibold text-navy-900">
                  {product.name}
                </h3>
                <p className="mb-3 line-clamp-2 text-xs text-slate-500">
                  {product.description}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-lg font-bold text-navy-900">
                    {formatCurrency(product.price)}
                  </span>
                  {product.weight && (
                    <Badge tone="navy">{product.weight}</Badge>
                  )}
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <Badge tone="slate">{CATEGORY_LABELS[product.category] ?? product.category}</Badge>
                  {canManage && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(product)}
                        leftIcon={<PencilLine className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPricesModal(product)}
                        leftIcon={<Tags className="w-3.5 h-3.5" />}
                      >
                        Prices
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? "Edit Product" : "Add New Product"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" loading={saving} disabled={saving}>
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Product Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="Price (NGN)"
              name="price"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <Input
            label="Weight (optional)"
            name="weight"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            placeholder="e.g. 12.5kg"
          />
        </form>
      </Modal>

      <Modal
        open={showPrices}
        onClose={() => setShowPrices(false)}
        title={pricesProduct ? `Prices — ${pricesProduct.name}` : "Prices"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPrices(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="prices-form"
              loading={pricesSaving}
              disabled={pricesSaving}
            >
              Save Prices
            </Button>
          </>
        }
      >
        <form id="prices-form" onSubmit={handleSavePrices} className="space-y-4">
          <p className="text-xs text-slate-500">
            Prices saved here apply immediately to the customer website
            catalog, POS and server-side order totals.
          </p>
          <Select
            label="Apply to"
            name="scope"
            value={priceScope}
            onChange={(e) => setPriceScope(e.target.value)}
          >
            <option value="all">All branches (global)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="space-y-3">
            {priceEntries.map((entry, idx) => (
              <div key={entry.sizeKg} className="flex items-end gap-3">
                <div className="w-32 shrink-0">
                  <Input
                    label={idx === 0 && entry.sizeKg === 0 ? "Flat price" : "Size (kg)"}
                    type="number"
                    min={0}
                    step="0.1"
                    value={String(entry.sizeKg)}
                    onChange={(e) =>
                      setPriceEntries((prev) =>
                        prev.map((en, i) =>
                          i === idx ? { ...en, sizeKg: Number(e.target.value) } : en,
                        ),
                      )
                    }
                  />
                </div>
                <Input
                  label="Price (NGN)"
                  type="number"
                  min={0}
                  value={entry.price}
                  onChange={(e) =>
                    setPriceEntries((prev) =>
                      prev.map((en, i) =>
                        i === idx ? { ...en, price: e.target.value } : en,
                      ),
                    )
                  }
                  required
                />
              </div>
            ))}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        size="lg"
        title={
          reviewing
            ? `${REQUEST_TYPE_LABELS[reviewing.type] ?? reviewing.type} — ${
                reviewing.productName ?? reviewing.proposal?.name ?? "product"
              }`
            : "Review change"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Close
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={reviewBusy}
              disabled={reviewBusy}
            >
              Reject
            </Button>
            <Button onClick={handleApprove} loading={reviewBusy} disabled={reviewBusy}>
              Approve & Apply
            </Button>
          </>
        }
      >
        {reviewing && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Requested by {reviewing.requestedBy ?? "secretary"} ·{" "}
              {new Date(reviewing.createdAt).toLocaleString()}. Approving
              applies this change to the website catalog, POS and admin views
              immediately.
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Current</th>
                    <th className="px-3 py-2 font-medium">Proposed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestRows(reviewing).map((row, idx) => (
                    <tr key={`${row.label}-${idx}`}>
                      <td className="px-3 py-2 text-slate-500">{row.label}</td>
                      <td className="px-3 py-2 text-slate-500 line-through decoration-slate-300">
                        {row.from}
                      </td>
                      <td className="px-3 py-2 font-medium text-navy-900">
                        {row.to}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <Input
                label="Rejection reason (required to reject)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Price is below our per-kg margin floor."
              />
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
