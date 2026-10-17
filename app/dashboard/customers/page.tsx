"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserRound,
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
  Plus,
  PencilLine,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  DataGrid,
  FilterBar,
  PageHeader,
  useToast,
  type Column,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/auth-context";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  createdAt: string;
}

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  defaultBranchId: string;
  password: string;
};

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  defaultBranchId: "",
  password: "",
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(c: { firstName: string; lastName: string }) {
  return `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function CustomersPage() {
  const toast = useToast();
  // Mirrors @Roles on the admin customers BFF writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
  const canDelete = useCan("super_admin", "admin");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const data = await api.get<{ customers: Customer[] }>("/admin/customers");
        setCustomers(data.customers ?? []);
      } catch {
        // graceful: empty grid shows an empty state
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
    api
      .get<{ branches: { id: string; name: string }[] }>("/admin/branches")
      .then((d) => setBranches(d.branches ?? []))
      .catch(() => setBranches([]));
  }, []);

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(c: Customer) {
    setEditing(c);
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      address: c.address ?? "",
      defaultBranchId: (c as Customer & { defaultBranchId?: string }).defaultBranchId ?? "",
      password: "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.patch<Customer>(`/admin/customers/${editing.id}`, form);
        setCustomers((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...c, ...updated } : c)),
        );
        setSelected((prev) => (prev && prev.id === editing.id ? { ...prev, ...updated } : prev));
        toast.success("Customer updated");
      } else {
        const created = await api.post<Customer>("/admin/customers", form);
        setCustomers((prev) => [
          { ...created, totalOrders: 0, totalSpent: 0, lastOrderDate: created.createdAt, address: "" },
          ...prev,
        ]);
        toast.success("Customer added");
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Customer) {
    if (!window.confirm(`Delete ${c.firstName} ${c.lastName}? Their past orders stay intact.`)) return;
    try {
      await api.delete(`/admin/customers/${c.id}`);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setSelected((prev) => (prev?.id === c.id ? null : prev));
      toast.success("Customer deleted");
    } catch (err: any) {
      toast.error(err?.message || "Could not delete customer.");
    }
  }

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const q = search.toLowerCase();
        return (
          !q ||
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(search)
        );
      }),
    [customers, search],
  );

  const filterFields: FilterField[] = useMemo(
    () => [{ key: "search", type: "search", placeholder: "Search by name, email or phone…" }],
    [],
  );

  const columns: Column<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (r) => `${r.firstName} ${r.lastName}`,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
            {initials(c)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-900">
              {c.firstName} {c.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (c) => <span className="text-sm text-slate-500">{c.phone || "—"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      sortable: true,
      sortValue: (r) => r.totalOrders,
      render: (c) => <span className="text-sm text-slate-700">{c.totalOrders}</span>,
    },
    {
      key: "spent",
      header: "Total Spent",
      align: "right",
      sortable: true,
      sortValue: (r) => r.totalSpent,
      render: (c) => (
        <span className="text-sm font-medium text-slate-700">
          {formatCurrency(c.totalSpent)}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout title="Customers" subtitle={`${customers.length} registered customers`}>
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="Everyone who has ordered from Malique, with lifetime value at a glance."
          icon={<Users className="w-5 h-5" />}
          actions={
            canManage && (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                Add Customer
              </Button>
            )
          }
        />

        <FilterBar
          fields={filterFields}
          values={{ search }}
          onChange={(_, value) => setSearch(value)}
          onReset={() => setSearch("")}
          right={<ExportMenu kind="customers" filters={{ search }} />}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataGrid
              columns={columns}
              rows={filtered}
              loading={loading}
              getRowId={(r) => r.id}
              pageSize={10}
              onRowClick={(c) => setSelected(c)}
              emptyTitle="No customers yet"
              emptyHint="Customers appear here automatically once they place their first order."
              rowActions={
                canManage
                  ? (c) => (
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(c)}
                          aria-label="Edit customer"
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(c)}
                            aria-label="Delete customer"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    )
                  : undefined
              }
            />
          </div>

          <div>
            {selected ? (
              <Card padded={false} className="sticky top-4 overflow-hidden">
                <div className="bg-gradient-to-r from-navy-900 to-navy-800 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">
                      {initials(selected)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {selected.firstName} {selected.lastName}
                      </h3>
                      <p className="text-xs text-slate-300">
                        Customer since {formatDate(selected.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <DetailRow icon={<Mail className="h-4 w-4" />} value={selected.email} />
                  <DetailRow icon={<Phone className="h-4 w-4" />} value={selected.phone || "—"} />
                  <DetailRow icon={<MapPin className="h-4 w-4" />} value={selected.address || "—"} />
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-lg font-bold text-navy-900">{selected.totalOrders}</p>
                      <p className="text-xs text-slate-500">Orders</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-lg font-bold text-navy-900">
                        {formatCurrency(selected.totalSpent)}
                      </p>
                      <p className="text-xs text-slate-500">Total Spent</p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-slate-500">
                    Last order: {formatDate(selected.lastOrderDate)}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    leftIcon={<ShoppingCart className="w-4 h-4" />}
                    onClick={() => {
                      window.location.href = `/dashboard/orders?customer=${encodeURIComponent(
                        `${selected.firstName} ${selected.lastName}`,
                      )}`;
                    }}
                  >
                    View Orders
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <UserRound className="h-6 w-6" />
                </div>
                <p className="text-sm text-slate-500">
                  Select a customer to view their details
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Customer" : "Add Customer"}
        description={
          editing
            ? `${editing.firstName} ${editing.lastName}`
            : "Register a customer so phone and counter sales link to their profile."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" loading={saving} disabled={saving}>
              {editing ? "Update Customer" : "Add Customer"}
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First Name"
              name="firstName"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              name="lastName"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <Select
              label="Default Branch"
              name="defaultBranchId"
              value={form.defaultBranchId}
              onChange={(e) => setForm({ ...form, defaultBranchId: e.target.value })}
            >
              <option value="">No default branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Address"
            name="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Delivery address (optional)"
          />
          <Input
            label={editing ? "New Password (leave blank to keep current)" : "Password (optional)"}
            name="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={editing ? "Unchanged" : "Blank generates a reset-able temporary one"}
          />
        </form>
      </Modal>
    </DashboardLayout>
  );
}

function DetailRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}
