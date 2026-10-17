"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Users,
  MapPin,
  Flame,
  Clock,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardHeader,
  StatTile,
  FilterBar,
  DataGrid,
  Badge,
  PageHeader,
  ExportMenu,
  type Column,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface DashboardResponse {
  kpis: {
    totalRevenue: number;
    monthlyRevenue: number;
    revenueGrowth: string;
    totalOrders: number;
    ordersGrowth: string;
    avgOrderValue: number;
    activeBranches: number;
    totalCustomers: number;
    clockedInNow: number;
    monthRevenueLabel: string;
  };
  analytics: {
    revenue: { total: number; thisMonth: number; lastMonth: number; growth: string };
    orders: { total: number; thisMonth: number; lastMonth: number; growth: string };
    avgOrderValue: number;
    branchPerformance: { branchName: string; orders: number; revenue: number }[];
    monthlyRevenue: { month: string; revenue: number; orders: number }[];
    orderStatusBreakdown: { status: string; count: number; percentage: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
  };
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    branchName: string;
    createdAt: string;
  }[];
  lowStockItems: {
    id: string;
    productName: string;
    branchName: string;
    currentStock: number;
    minStock: number;
    status: string;
  }[];
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n || 0);

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#10b981",
  Delivering: "#8b5cf6",
  Processing: "#6366f1",
  Pending: "#f59e0b",
  Cancelled: "#ef4444",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({
    branchId: "",
    rangeStart: "",
    rangeEnd: "",
  });

  useEffect(() => {
    api
      .get<{ branches: { id: string; name: string }[] }>("/admin/branches")
      .then((res) =>
        setBranches((res.branches ?? []).map((b) => ({ value: b.id, label: b.name }))),
      )
      .catch(() => setBranches([]));
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (filters.branchId) params.set("branchId", filters.branchId);
    if (filters.rangeStart) params.set("from", filters.rangeStart);
    if (filters.rangeEnd) params.set("to", filters.rangeEnd);
    try {
      const res = await api.get<DashboardResponse>(`/admin/dashboard?${params.toString()}`);
      setData(res);
    } catch {
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Live dashboard: quietly refresh KPIs/charts every 30s (no skeleton flash)
  // so the board looks alive during demos without WebSocket infrastructure.
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const setFilter = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const statusChartData = useMemo(
    () => data?.analytics.orderStatusBreakdown ?? [],
    [data],
  );

  const recentColumns: Column<DashboardResponse["recentOrders"][number]>[] = [
    {
      key: "orderNumber",
      header: "Order",
      sortable: true,
      sortValue: (r) => r.orderNumber,
      render: (r) => <span className="font-medium text-navy-900">{r.orderNumber}</span>,
    },
    { key: "customerName", header: "Customer", render: (r) => r.customerName },
    {
      key: "branchName",
      header: "Branch",
      render: (r) => <span className="text-slate-500">{r.branchName}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={statusTone(r.status)} dot>{labelize(r.status)}</Badge>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => <span className="font-semibold text-navy-900">{currency(r.total)}</span>,
    },
  ];

  const k = data?.kpis;

  return (
    <DashboardLayout title="Dashboard" subtitle="Command centre & analytics">
      <div className="space-y-6">
        <PageHeader
          title="Business Overview"
          description="Live revenue, orders, staffing and gas accountability across your Rivers State branches."
          icon={<LayoutDashboard className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <ExportMenu
                kind="dashboard"
                filters={{
                  branchId: filters.branchId,
                  from: filters.rangeStart,
                  to: filters.rangeEnd,
                }}
              />
              <Link
                href="/dashboard/gas"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 px-4 h-10 text-sm font-semibold text-amber-400 shadow-sm hover:from-navy-800 hover:to-navy-900 transition-all"
              >
                <Flame className="w-4 h-4" />
                Gas Balance
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          }
        />

        {/* Global filters */}
        <FilterBar
          fields={[
            {
              key: "branchId",
              type: "select",
              label: "All Branches",
              options: branches,
            },
            { key: "range", type: "daterange", label: "Date range" },
          ]}
          values={filters}
          onChange={(key, value) => {
            if (key === "rangeStart" || key === "rangeEnd") setFilter(key, value);
            else setFilter(key, value);
          }}
          onReset={() => setFilters({ branchId: "", rangeStart: "", rangeEnd: "" })}
          right={
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · auto-refresh 30s
            </span>
          }
        />

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatTile
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Revenue"
            value={currency(k?.totalRevenue ?? 0)}
            trend={k?.revenueGrowth ? parseTrend(k.revenueGrowth) : undefined}
            accent="green"
          />
          <StatTile
            icon={<ShoppingCart className="w-5 h-5" />}
            label="Total Orders"
            value={(k?.totalOrders ?? 0).toLocaleString()}
            trend={k?.ordersGrowth ? parseTrend(k.ordersGrowth) : undefined}
            accent="blue"
          />
          <StatTile
            icon={<DollarSign className="w-5 h-5" />}
            label="Avg Order Value"
            value={currency(k?.avgOrderValue ?? 0)}
            accent="amber"
          />
          <StatTile
            icon={<MapPin className="w-5 h-5" />}
            label="Active Branches"
            value={k?.activeBranches ?? 0}
            accent="navy"
          />
          <StatTile
            icon={<Users className="w-5 h-5" />}
            label="Customers"
            value={(k?.totalCustomers ?? 0).toLocaleString()}
            accent="purple"
          />
          <StatTile
            icon={<Clock className="w-5 h-5" />}
            label="Clocked-in Now"
            value={k?.clockedInNow ?? 0}
            accent="green"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader title="Revenue & Orders" subtitle="Last 6 months" />
            <div className="mt-4 h-72">
              {loading ? (
                <SkeletonChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.analytics.monthlyRevenue ?? []}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4A853" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#D4A853" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ord" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4164a5" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#4164a5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="rev"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <YAxis
                      yAxisId="ord"
                      orientation="right"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip formatter={(v: any, n: any) => (n === "Revenue" ? currency(Number(v)) : v)} />
                    <Legend />
                    <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#D4A853" strokeWidth={2} fill="url(#rev)" />
                    <Area yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#4164a5" strokeWidth={2} fill="url(#ord)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Order Status" subtitle="Distribution" />
            <div className="mt-4 h-72">
              {loading ? (
                <SkeletonChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Branch performance + top products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Branch Performance" subtitle="Ranked by revenue" />
            <div className="mt-4 space-y-3">
              {loading ? (
                <SkeletonList />
              ) : data?.analytics.branchPerformance.length ? (
                data.analytics.branchPerformance.map((b, i) => {
                  const max = data.analytics.branchPerformance[0].revenue || 1;
                  const pct = Math.round((b.revenue / max) * 100);
                  return (
                    <div key={b.branchName}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-navy-900">
                          {i + 1}. {b.branchName}
                        </span>
                        <span className="text-slate-500">
                          {currency(b.revenue)} · {b.orders} orders
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyLine />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Top Products" subtitle="By revenue" />
            <div className="mt-4 space-y-3">
              {loading ? (
                <SkeletonList />
              ) : data?.analytics.topProducts.length ? (
                data.analytics.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-xs font-bold text-navy-700">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-navy-900">{p.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-navy-900">{currency(p.revenue)}</p>
                      <p className="text-xs text-slate-400">{p.quantity} sold</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyLine />
              )}
            </div>
          </Card>
        </div>

        {/* Recent orders + low stock */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-900">Recent Orders</h3>
              <Link href="/dashboard/orders" className="text-xs font-medium text-amber-600 hover:text-amber-700">
                View all →
              </Link>
            </div>
            <DataGrid
              columns={recentColumns}
              rows={data?.recentOrders ?? []}
              loading={loading}
              getRowId={(r) => r.id}
              onRowClick={(r) => (window.location.href = `/dashboard/orders/${r.id}`)}
              emptyTitle="No orders yet"
            />
          </div>

          <Card>
            <CardHeader
              title="Low Stock Alerts"
              icon={<Flame className="w-5 h-5" />}
              action={
                <Link href="/dashboard/inventory" className="text-xs font-medium text-amber-600 hover:text-amber-700">
                  Manage →
                </Link>
              }
            />
            <div className="mt-4 space-y-2.5">
              {loading ? (
                <SkeletonList />
              ) : data?.lowStockItems.length ? (
                data.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{item.productName}</p>
                      <p className="text-xs text-slate-400">{item.branchName}</p>
                    </div>
                    <Badge tone={item.status === "out_of_stock" ? "red" : item.status === "critical" ? "red" : "amber"}>
                      {item.currentStock} left
                    </Badge>
                  </div>
                ))
              ) : (
                <EmptyLine />
              )}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── local helpers ───────────────────────────────────────
function statusTone(status: string): "green" | "amber" | "blue" | "purple" | "red" | "navy" {
  switch (status) {
    case "delivered":
      return "green";
    case "delivering":
      return "purple";
    case "processing":
      return "blue";
    case "pending":
      return "amber";
    case "cancelled":
      return "red";
    default:
      return "navy";
  }
}

function labelize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseTrend(g: string): { value: string; direction: "up" | "down" } {
  const dir = g.trim().startsWith("-") ? "down" : "up";
  return { value: g, direction: dir as "up" | "down" };
}

function SkeletonChart() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-slate-50" />;
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyLine() {
  return <p className="py-6 text-center text-sm text-slate-400">No data for this period.</p>;
}
