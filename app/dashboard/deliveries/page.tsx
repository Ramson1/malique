"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Package,
  User,
  Phone,
  UserRoundCog,
  CheckCircle2,
  XCircle,
  FileDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Badge,
  Button,
  Modal,
  FilterBar,
  PageHeader,
  StatTile,
  useToast,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { downloadManifest } from "@/lib/export";

interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  riderName: string;
  riderPhone: string;
  branchName: string;
  status: string;
  assignedAt: string;
  estimatedDelivery: string;
  deliveredAt?: string;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  branchName: string;
}

const STATUS_META: Record<string, { label: string; tone: "amber" | "blue" | "green" | "red" }> = {
  pending: { label: "Pending", tone: "amber" },
  delivering: { label: "Delivering", tone: "blue" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeliveriesPage() {
  const toast = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    status: "",
  });
  const [assignModal, setAssignModal] = useState<Delivery | null>(null);
  const [manifestBusy, setManifestBusy] = useState<string | null>(null);

  async function handleManifest(deliveryId: string) {
    setManifestBusy(deliveryId);
    try {
      const name = await downloadManifest(deliveryId);
      toast.success(`${name} downloaded.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate the manifest.");
    } finally {
      setManifestBusy(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [d, r] = await Promise.all([
          api.get<{ deliveries: Delivery[] }>("/admin/deliveries"),
          api.get<{ riders: Rider[] }>("/admin/riders").catch(() => ({ riders: [] })),
        ]);
        setDeliveries(d.deliveries ?? []);
        setRiders(r.riders ?? []);
      } catch {
        toast.error("Could not load deliveries. Please retry.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function assignRider(rider: Rider) {
    if (!assignModal) return;
    try {
      await api.patch(`/admin/deliveries/${assignModal.id}/assign`, {
        riderName: rider.name,
        riderPhone: rider.phone,
      });
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === assignModal.id
            ? { ...d, riderName: rider.name, riderPhone: rider.phone, status: "delivering" }
            : d,
        ),
      );
      toast.success(`Rider ${rider.name} assigned`);
      setAssignModal(null);
    } catch {
      toast.error("Failed to assign rider. Ensure the rider has an account.");
    }
  }

  async function markDelivered(deliveryId: string) {
    try {
      await api.patch(`/admin/deliveries/${deliveryId}/status`, { status: "delivered" });
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === deliveryId
            ? { ...d, status: "delivered", deliveredAt: new Date().toISOString() }
            : d,
        ),
      );
      toast.success("Delivery marked as delivered");
    } catch {
      toast.error("Failed to update delivery status.");
    }
  }

  // Soft cancel: the delivery flips to `returned` on the server (shown as
  // "Cancelled"); the order and its history stay intact.
  async function cancelDelivery(delivery: Delivery) {
    if (!window.confirm(`Cancel delivery for ${delivery.orderNumber}? The rider will be stood down.`)) return;
    try {
      await api.patch(`/admin/deliveries/${delivery.id}/status`, { status: "cancelled" });
      setDeliveries((prev) =>
        prev.map((d) => (d.id === delivery.id ? { ...d, status: "cancelled" } : d)),
      );
      toast.success("Delivery cancelled");
    } catch {
      toast.error("Failed to cancel delivery.");
    }
  }

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search by order, customer or rider…" },
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
    [],
  );

  const filtered = deliveries.filter((d) => {
    const q = filters.search.toLowerCase();
    const matchSearch =
      !q ||
      d.orderNumber.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      d.riderName.toLowerCase().includes(q);
    const matchStatus = !filters.status || d.status === filters.status;
    return matchSearch && matchStatus;
  });

  const activeCount = deliveries.filter((d) => d.status === "delivering").length;
  const pendingCount = deliveries.filter((d) => d.status === "pending").length;
  const deliveredCount = deliveries.filter((d) => d.status === "delivered").length;

  return (
    <DashboardLayout title="Deliveries" subtitle="Track and manage active deliveries">
      <div className="space-y-6">
        <PageHeader
          title="Deliveries"
          description="Assign riders and track every gas delivery from your branches to customers."
          icon={<Truck className="w-5 h-5" />}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={<Truck className="w-5 h-5" />}
            label="Active"
            value={activeCount}
            accent="purple"
          />
          <StatTile icon={<Clock className="w-5 h-5" />} label="Pending" value={pendingCount} accent="amber" />
          <StatTile
            icon={<Package className="w-5 h-5" />}
            label="Delivered"
            value={deliveredCount}
            accent="green"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", status: "" })}
          right={<ExportMenu kind="deliveries" filters={{ search: filters.search, status: filters.status }} />}
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-4 w-1/3 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Truck className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-navy-900">No deliveries found</p>
            <p className="max-w-sm text-xs text-slate-500">
              Adjust your filters — deliveries appear here as orders are confirmed.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((delivery) => {
              const meta = STATUS_META[delivery.status] ?? {
                label: delivery.status,
                tone: "amber" as const,
              };
              return (
                <Card key={delivery.id} hover>
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-sm font-semibold text-navy-900">
                          {delivery.orderNumber}
                        </span>
                        <Badge tone={meta.tone} dot>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{delivery.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{delivery.deliveryAddress}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Truck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{delivery.riderName}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Branch: {delivery.branchName}</span>
                        <span>ETA: {formatTime(delivery.estimatedDelivery)}</span>
                        {delivery.deliveredAt && (
                          <span>Delivered: {formatTime(delivery.deliveredAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={manifestBusy === delivery.id}
                        onClick={() => handleManifest(delivery.id)}
                        leftIcon={<FileDown className="w-3.5 h-3.5" />}
                      >
                        Manifest
                      </Button>
                      {delivery.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => setAssignModal(delivery)}
                          leftIcon={<UserRoundCog className="w-3.5 h-3.5" />}
                        >
                          Assign Rider
                        </Button>
                      )}
                      {delivery.status === "delivering" && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => markDelivered(delivery.id)}
                          leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        >
                          Mark Delivered
                        </Button>
                      )}
                      {(delivery.status === "pending" || delivery.status === "delivering") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelDelivery(delivery)}
                          leftIcon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title="Assign Rider"
        description={
          assignModal ? `${assignModal.orderNumber} — ${assignModal.branchName}` : undefined
        }
        size="sm"
      >
        {riders.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-navy-900">No riders available</p>
            <p className="mt-1 text-xs text-slate-500">
              Add staff accounts with the Rider role to enable assignment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {riders.map((rider) => (
              <button
                key={rider.id}
                onClick={() => assignRider(rider)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Truck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900">{rider.name}</p>
                  <p className="text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {rider.phone || "—"}
                    </span>
                    {" · "}
                    {rider.branchName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
