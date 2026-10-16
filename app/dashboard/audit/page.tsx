"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Activity,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  DataGrid,
  FilterBar,
  PageHeader,
  type Column,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface AuditLogEntry {
  id: string;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  actionType: string;
  action: string;
  resource: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  statusCode: number | null;
  success: boolean;
  createdAt: string;
}

interface AuditResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_TONE: Record<
  string,
  { tone: "blue" | "slate" | "green" | "amber" | "red" | "indigo" | "neutral" }
> = {
  login: { tone: "blue" },
  logout: { tone: "slate" },
  create: { tone: "green" },
  update: { tone: "amber" },
  delete: { tone: "red" },
  read: { tone: "indigo" },
};

const ACTION_ICON: Record<string, typeof Activity> = {
  login: LogIn,
  logout: LogOut,
  create: Plus,
  update: Edit2,
  delete: Trash2,
};

const ROLE_TONE: Record<string, "red" | "blue" | "slate" | "purple" | "neutral"> = {
  admin: "red",
  branch_manager: "blue",
  staff: "slate",
  rider: "purple",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    actionType: "",
  });
  const [committedSearch, setCommittedSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (filters.actionType) params.set("actionType", filters.actionType);
      if (committedSearch.trim()) params.set("actor", committedSearch.trim());

      const res = await api.get<AuditResponse>(`/audit-logs?${params.toString()}`);
      setLogs(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters.actionType, committedSearch]);

  // Debounce the search box before it drives the server query.
  useEffect(() => {
    const id = setTimeout(() => {
      setCommittedSearch(filters.search);
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [filters.search]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filterFields: FilterField[] = [
    { key: "search", type: "search", placeholder: "Search by admin name or email…" },
    {
      key: "actionType",
      type: "select",
      label: "All actions",
      options: [
        { value: "login", label: "Login" },
        { value: "logout", label: "Logout" },
        { value: "create", label: "Create" },
        { value: "update", label: "Update" },
        { value: "delete", label: "Delete" },
      ],
    },
  ];

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "time",
      header: "Time",
      render: (log) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {formatDateTime(log.createdAt)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (log) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
            {(log.actorName || log.actorEmail || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-navy-900">
              {log.actorName || log.actorEmail || "Unknown"}
            </p>
            {log.actorRole && (
              <Badge tone={ROLE_TONE[log.actorRole] ?? "neutral"} className="mt-0.5">
                {log.actorRole.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (log) => {
        const Icon = ACTION_ICON[log.actionType] ?? Activity;
        return (
          <div>
            <Badge tone={ACTION_TONE[log.actionType]?.tone ?? "neutral"}>
              <span className="flex items-center gap-1.5 capitalize">
                <Icon className="h-3.5 w-3.5" />
                {log.actionType}
              </span>
            </Badge>
            <p
              className="mt-1 max-w-[180px] truncate text-xs text-slate-400"
              title={log.action}
            >
              {log.action}
            </p>
          </div>
        );
      },
    },
    {
      key: "endpoint",
      header: "Endpoint",
      render: (log) => (
        <div className="flex items-center gap-2">
          {log.method && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {log.method}
            </span>
          )}
          <span
            className="max-w-[220px] truncate font-mono text-xs text-slate-600"
            title={log.path ?? ""}
          >
            {log.path ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "result",
      header: "Result",
      render: (log) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            log.success ? "text-emerald-600" : "text-red-600"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              log.success ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          {log.success ? "Success" : "Failed"}
          {log.statusCode && (
            <span className="font-normal text-slate-400">· {log.statusCode}</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout title="Audit Log" subtitle="Admin & staff activity (super admin is never tracked)">
      <div className="space-y-6">
        <PageHeader
          title="Audit Log"
          description="Every action performed by portal admins and staff. Super admin activity is not tracked."
          icon={<ShieldCheck className="w-5 h-5" />}
          actions={
            <Button
              variant="outline"
              onClick={load}
              leftIcon={
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              }
            >
              Refresh
            </Button>
          }
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
            setPage(1);
          }}
          onReset={() => setFilters({ search: "", actionType: "" })}
          right={
            <ExportMenu
              kind="audit"
              filters={{ search: filters.search, status: filters.actionType }}
            />
          }
        />

        <DataGrid
          columns={columns}
          rows={logs}
          loading={loading}
          getRowId={(r) => r.id}
          emptyTitle="No activity recorded yet"
          emptyHint="Actions performed by admins and staff will appear here."
        />

        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-1 text-sm text-slate-500">
            <p>
              Showing {logs.length} of {total.toLocaleString()} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
