"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  UserRoundX,
  CalendarCheck,
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

interface AttendanceRecord {
  id: string;
  userId: string;
  branchId: string;
  shiftType: string;
  attendanceStatus: string;
  staffName: string;
  staffEmail: string;
  branchName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  totalHours: number;
  notes: string;
}

type AttendanceForm = {
  userId: string;
  branchId: string;
  clockIn: string;
  clockOut: string;
  attendanceStatus: string;
  shiftType: string;
  notes: string;
};

const emptyForm: AttendanceForm = {
  userId: "",
  branchId: "",
  clockIn: "",
  clockOut: "",
  attendanceStatus: "present",
  shiftType: "full_day",
  notes: "",
};

// datetime-local input value from an ISO string (local time, minute precision).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const toast = useToast();
  // Mirrors @Roles('super_admin','admin','branch_manager') on attendance writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    date: "",
    branch: "",
  });
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [branchOptions2, setBranchOptions2] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AttendanceForm>(emptyForm);

  const fetchAttendance = useCallback(async () => {
    try {
      const data = await api.get<{ records: AttendanceRecord[] }>("/admin/attendance");
      setRecords(data.records ?? []);
    } catch {
      // graceful empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    api
      .get<{ staff: { id: string; firstName: string; lastName: string }[] }>("/admin/staff")
      .then((d) =>
        setStaffOptions(
          (d.staff ?? []).map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })),
        ),
      )
      .catch(() => setStaffOptions([]));
    api
      .get<{ branches: { id: string; name: string }[] }>("/admin/branches")
      .then((d) => setBranchOptions2(d.branches ?? []))
      .catch(() => setBranchOptions2([]));
  }, [fetchAttendance]);

  function openAddModal() {
    setEditing(null);
    setForm({ ...emptyForm, clockIn: toLocalInput(new Date().toISOString()) });
    setShowModal(true);
  }

  function openEditModal(r: AttendanceRecord) {
    setEditing(r);
    setForm({
      userId: r.userId,
      branchId: r.branchId,
      clockIn: toLocalInput(r.clockIn),
      clockOut: toLocalInput(r.clockOut),
      attendanceStatus: r.attendanceStatus || "present",
      shiftType: r.shiftType || "full_day",
      notes: r.notes ?? "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        userId: form.userId,
        branchId: form.branchId,
        clockIn: form.clockIn ? new Date(form.clockIn).toISOString() : undefined,
        clockOut: form.clockOut ? new Date(form.clockOut).toISOString() : undefined,
        status: form.attendanceStatus,
        shiftType: form.shiftType,
        notes: form.notes,
      };
      if (editing) {
        await api.patch(`/admin/attendance/${editing.id}`, payload);
        toast.success("Attendance record updated");
      } else {
        await api.post("/admin/attendance", payload);
        toast.success("Attendance logged");
      }
      setShowModal(false);
      await fetchAttendance();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save attendance record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: AttendanceRecord) {
    if (!window.confirm(`Delete ${r.staffName}'s record for ${r.date}?`)) return;
    try {
      await api.delete(`/admin/attendance/${r.id}`);
      setRecords((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Attendance record deleted");
    } catch (err: any) {
      toast.error(err?.message || "Could not delete attendance record.");
    }
  }

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
          actions={
            canManage && (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                Log Attendance
              </Button>
            )
          }
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
          rowActions={
            canManage
              ? (r) => (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(r)}
                      aria-label="Edit record"
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r)}
                      aria-label="Delete record"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Attendance Record" : "Log Attendance"}
        description={
          editing
            ? `${editing.staffName} · ${editing.date}`
            : "Manually record or correct a staff member's shift."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="attendance-form" loading={saving} disabled={saving}>
              {editing ? "Update Record" : "Log Record"}
            </Button>
          </>
        }
      >
        <form id="attendance-form" onSubmit={handleSave} className="space-y-4">
          <Select
            label="Staff Member"
            name="userId"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            required
          >
            <option value="">Select staff…</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label="Branch"
            name="branchId"
            value={form.branchId}
            onChange={(e) => setForm({ ...form, branchId: e.target.value })}
            required
          >
            <option value="">Select branch…</option>
            {branchOptions2.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Clock In"
              name="clockIn"
              type="datetime-local"
              value={form.clockIn}
              onChange={(e) => setForm({ ...form, clockIn: e.target.value })}
              required
            />
            <Input
              label="Clock Out (blank = still on shift)"
              name="clockOut"
              type="datetime-local"
              value={form.clockOut}
              onChange={(e) => setForm({ ...form, clockOut: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Status"
              name="attendanceStatus"
              value={form.attendanceStatus}
              onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value })}
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </Select>
            <Select
              label="Shift Type"
              name="shiftType"
              value={form.shiftType}
              onChange={(e) => setForm({ ...form, shiftType: e.target.value })}
            >
              <option value="full_day">Full Day</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </Select>
          </div>
          <Input
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Reason for manual entry or correction (optional)"
          />
        </form>
      </Modal>
    </DashboardLayout>
  );
}
