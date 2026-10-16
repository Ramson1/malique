"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserRound,
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Button,
  DataGrid,
  FilterBar,
  PageHeader,
  type Column,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

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
  }, []);

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
