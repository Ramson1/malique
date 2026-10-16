"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, LogIn, LogOut, UserRoundX, CalendarCheck } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  DataGrid,
  FilterBar,
  PageHeader,
  StatTile,
  type Column,
  type FilterField,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface AttendanceRecord {
  id: string;
  staffName: string;
  staffEmail: string;
  branchName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  totalHours: number;
}

const STATUS_META: Record<string, { label: string; tone: "green" | "slate" | "red" }> = {
  clocked_in: { label: "Clocked In", tone: "green" },
  clocked_out: { label: "Clocked Out", tone: "slate" },
  inactive: { label: "Absent", tone: "red" },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    date: "",
    branch: "",
  });

  useEffect(() => {
    async function fetchAttendance() {
      try {
        const data = await api.get<{ records: AttendanceRecord[] }>("/admin/attendance");
        setRecords(data.records ?? []);
      } catch {
        // graceful empty state
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, []);

  const branchOptions = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.branchName))).map((b) => ({
        value: b,
        label: b,
      })),
    [records],
  );

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search staff by name or email…" },
      { key: "date", type: "date", label: "Date" },
      { key: "branch", type: "select", label: "All Branches", options: branchOptions },
    ],
    [branchOptions],
  );

  const filtered = records.filter((r) => {
    const q = filters.search.toLowerCase();
    const matchSearch =
      !q ||
      r.staffName?.toLowerCase().includes(q) ||
      r.staffEmail?.toLowerCase().includes(q);
    const matchBranch = !filters.branch || r.branchName === filters.branch;
    const matchDate = !filters.date || r.date === filters.date;
    return matchSearch && matchBranch && matchDate;
  });

  const clockedIn = records.filter((r) => r.status === "clocked_in").length;
  const clockedOut = records.filter((r) => r.status === "clocked_out").length;
  const absent = records.filter((r) => r.status === "inactive").length;

  const columns: Column<AttendanceRecord>[] = [
    {
      key: "staff",
      header: "Staff",
      sortable: true,
      sortValue: (r) => r.staffName,
      render: (record) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
            {initials(record.staffName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-900">{record.staffName}</p>
            <p className="truncate text-xs text-slate-500">{record.staffEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (record) => <span className="text-sm text-slate-500">{record.branchName}</span>,
    },
    {
      key: "clockIn",
      header: "Clock In",
      render: (record) => (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-sm text-slate-700">{formatTime(record.clockIn)}</span>
        </div>
      ),
    },
    {
      key: "clockOut",
      header: "Clock Out",
      render: (record) => (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-sm text-slate-700">{formatTime(record.clockOut)}</span>
        </div>
      ),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      sortable: true,
      sortValue: (r) => r.totalHours,
      render: (record) => (
        <span className="text-sm font-medium text-slate-700">
          {record.totalHours > 0 ? `${record.totalHours}h` : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (record) => {
        const meta = STATUS_META[record.status] ?? {
          label: record.status,
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
    <DashboardLayout title="Attendance" subtitle="Track staff clock-in and clock-out records">
      <div className="space-y-6">
        <PageHeader
          title="Attendance"
          description="Live clock-in / clock-out records across your branches."
          icon={<CalendarCheck className="w-5 h-5" />}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            icon={<LogIn className="w-5 h-5" />}
            label="Clocked In"
            value={clockedIn}
            accent="green"
          />
          <StatTile
            icon={<LogOut className="w-5 h-5" />}
            label="Clocked Out"
            value={clockedOut}
            accent="navy"
          />
          <StatTile
            icon={<UserRoundX className="w-5 h-5" />}
            label="Absent"
            value={absent}
            accent="red"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", date: "", branch: "" })}
          right={
            <ExportMenu
              kind="attendance"
              filters={{
                search: filters.search,
                branchId: filters.branch,
                from: filters.date,
                to: filters.date,
              }}
            />
          }
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => r.id}
          emptyTitle="No attendance records"
          emptyHint="Records appear here as staff clock in and out."
        />
      </div>
    </DashboardLayout>
  );
}
