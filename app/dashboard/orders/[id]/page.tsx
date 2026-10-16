"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  CreditCard,
  Truck,
  CheckCircle2,
  Circle,
  XCircle,
  FileDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Badge,
  Button,
  PageHeader,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { downloadInvoice } from "@/lib/export";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  branchName: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  timeline: TimelineEntry[];
}

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface TimelineEntry {
  status: string;
  timestamp: string;
  note?: string;
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
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIMELINE_ICON: Record<string, typeof Circle> = {
  pending: Circle,
  confirmed: CheckCircle2,
  processing: Package,
  delivering: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

const TIMELINE_COLOR: Record<string, string> = {
  pending: "text-amber-500",
  confirmed: "text-blue-500",
  processing: "text-indigo-500",
  delivering: "text-purple-500",
  delivered: "text-emerald-500",
  cancelled: "text-red-500",
};

// Next-allowed status transitions shown as quick actions.
const NEXT_ACTION: Record<
  string,
  { status: string; label: string; icon: typeof Circle } | null
> = {
  pending: { status: "confirmed", label: "Confirm", icon: CheckCircle2 },
  confirmed: { status: "processing", label: "Process", icon: Package },
  processing: { status: "delivering", label: "Dispatch", icon: Truck },
  delivering: { status: "delivered", label: "Mark Delivered", icon: CheckCircle2 },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadInvoice() {
    setDownloading(true);
    try {
      const name = await downloadInvoice(order!.id);
      toast.success(`${name} downloaded.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the invoice.");
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    async function fetchOrder() {
      try {
        const data = await api.get<OrderDetail>(`/admin/orders/${params.id}`);
        setOrder(data);
      } catch {
        toast.error("Could not load this order.");
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function updateStatus(newStatus: string) {
    if (!order) return;
    setUpdating(true);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status: newStatus });
      setOrder({ ...order, status: newStatus });
      toast.success("Order status updated");
    } catch {
      toast.error("Failed to update order status.");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Order Detail" subtitle="Loading…">
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Order Detail">
        <Card className="py-16 text-center">
          <p className="text-sm font-semibold text-navy-900">Order not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/dashboard/orders")}
          >
            Back to Orders
          </Button>
        </Card>
      </DashboardLayout>
    );
  }

  const nextAction = NEXT_ACTION[order.status];
  const NextIcon = nextAction?.icon;

  return (
    <DashboardLayout
      title={`Order ${order.orderNumber}`}
      subtitle={`Placed on ${formatDate(order.createdAt)}`}
    >
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/orders")}
          className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-navy-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </button>

        <PageHeader
          title={`Order ${order.orderNumber}`}
          description={`Placed ${formatDate(order.createdAt)} · ${order.branchName}`}
          icon={<Package className="h-5 h-5" />}
          actions={
            <>
              <Badge tone={STATUS_TONE[order.status] ?? "neutral"} dot>
                <span className="capitalize">{order.status}</span>
              </Badge>
              <Button
                variant="secondary"
                onClick={handleDownloadInvoice}
                loading={downloading}
                leftIcon={<FileDown className="w-4 h-4" />}
              >
                Invoice PDF
              </Button>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <Button
                  variant="outline"
                  onClick={() => updateStatus("cancelled")}
                  loading={updating}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Cancel
                </Button>
              )}
              {nextAction && NextIcon && (
                <Button
                  onClick={() => updateStatus(nextAction.status)}
                  loading={updating}
                  leftIcon={<NextIcon className="w-4 h-4" />}
                >
                  {nextAction.label}
                </Button>
              )}
            </>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-6 lg:col-span-2">
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-navy-900">Order Items</h2>
                <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                  <span className="capitalize">{order.status}</span>
                </Badge>
              </div>
              <div className="divide-y divide-slate-50">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {formatCurrency(item.totalPrice)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
                <SummaryRow label="Subtotal" value={formatCurrency(order.subtotal)} />
                <SummaryRow label="Delivery Fee" value={formatCurrency(order.deliveryFee)} />
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-navy-900">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-navy-900">Order Timeline</h2>
              </div>
              <div className="p-5">
                {order.timeline.map((entry, index) => {
                  const Icon = TIMELINE_ICON[entry.status] || Circle;
                  const color = TIMELINE_COLOR[entry.status] || "text-slate-400";
                  const isLast = index === order.timeline.length - 1;
                  return (
                    <div key={index} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current bg-white ${color}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-slate-200" />}
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-medium capitalize text-navy-900">
                          {entry.status}
                        </p>
                        {entry.note && (
                          <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-navy-900">Customer Details</h2>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">{order.customerName}</p>
                    <p className="truncate text-xs text-slate-500">{order.customerEmail}</p>
                  </div>
                </div>
                <InfoRow icon={<Phone className="h-4 w-4" />} value={order.customerPhone} />
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  value={order.deliveryAddress}
                  alignStart
                />
              </div>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-navy-900">Order Information</h2>
              </div>
              <div className="space-y-3 p-5">
                <LabeledRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Branch"
                  value={order.branchName}
                />
                <LabeledRow
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Payment"
                  value={<span className="capitalize">{order.paymentMethod || "—"}</span>}
                />
                <LabeledRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Last Updated"
                  value={formatDate(order.updatedAt)}
                />
              </div>
            </Card>

            {order.notes && (
              <Card padded={false} className="overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-navy-900">Notes</h2>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-700">{order.notes}</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoRow({
  icon,
  value,
  alignStart,
}: {
  icon: React.ReactNode;
  value: string;
  alignStart?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${alignStart ? "items-start" : "items-center"}`}>
      <span className={`text-slate-400 ${alignStart ? "mt-0.5" : ""}`}>{icon}</span>
      <span className="text-sm text-slate-700">{value || "—"}</span>
    </div>
  );
}

function LabeledRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}
