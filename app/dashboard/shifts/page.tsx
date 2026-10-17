"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  X,
  PencilLine,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Card,
  PageHeader,
  ExportMenu,
  SkeletonList,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  minStaff: number;
  capacity: number | null;
  isDefault: boolean;
  description?: string;
}
interface RosterStaff {
  id: string;
  name: string;
  jobTitle?: string;
}
interface Assignment {
  id: string;
  shiftId: string;
  userId: string;
  staffName: string;
  workDate: string;
  status: string;
  note?: string;
}
interface BranchOption {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, "slate" | "green" | "red" | "amber"> = {
  scheduled: "slate",
  present: "green",
  absent: "red",
  swapped: "amber",
};
const STATUSES = ["scheduled", "present", "absent", "swapped"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayLabel(d: Date) {
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric" });
}
function qs(params: Record<string, string | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export default function ShiftsPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [anchor, setAnchor] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<RosterStaff[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);

  const [shiftModal, setShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "16:00",
    minStaff: "1",
    capacity: "",
    isDefault: false,
    description: "",
  });

  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    userId: "",
    shiftId: "",
    workDate: "",
  });

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<{ branches: BranchOption[] }>("/admin/branches");
        setBranches(d.branches ?? []);
        const firstActive = d.branches?.find((b) => b.name?.includes("Igboh")) ?? d.branches?.[0];
        if (firstActive) setBranchId(firstActive.id);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const loadRoster = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const r = await api.get<{ shifts: Shift[]; staff: RosterStaff[]; assignments: Assignment[] }>(
        `/shifts/roster${qs({ branchId, from: ymd(days[0]), to: ymd(days[6]) })}`,
      );
      setShifts(r.shifts ?? []);
      setStaff(r.staff ?? []);
      setAssignments(r.assignments ?? []);
    } catch {
      toast.error("Could not load the roster.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, ymd(days[0]), ymd(days[6])]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const shiftById = useMemo(() => {
    const m: Record<string, Shift> = {};
    for (const s of shifts) m[s.id] = s;
    return m;
  }, [shifts]);

  // Group assignments by `${userId}|${date}`.
  const cellMap = useMemo(() => {
    const m: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      const key = `${a.userId}|${a.workDate}`;
      (m[key] ??= []).push(a);
    }
    return m;
  }, [assignments]);

  function openAddShift() {
    setEditingShift(null);
    setShiftForm({ name: "", startTime: "08:00", endTime: "16:00", minStaff: "1", capacity: "", isDefault: false, description: "" });
    setShiftModal(true);
  }
  function openEditShift(s: Shift) {
    setEditingShift(s);
    setShiftForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      minStaff: String(s.minStaff),
      capacity: s.capacity ? String(s.capacity) : "",
      isDefault: s.isDefault,
      description: s.description ?? "",
    });
    setShiftModal(true);
  }

  async function saveShift(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        branchId,
        name: shiftForm.name,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        minStaff: Number(shiftForm.minStaff) || 1,
        capacity: shiftForm.capacity ? Number(shiftForm.capacity) : undefined,
        isDefault: shiftForm.isDefault,
        description: shiftForm.description || undefined,
      };
      if (editingShift) await api.patch(`/shifts/${editingShift.id}`, payload);
      else await api.post("/shifts", payload);
      toast.success(editingShift ? "Shift updated" : "Shift created");
      setShiftModal(false);
      loadRoster();
    } catch {
      toast.error("Failed to save shift.");
    }
  }

  async function deleteShift(s: Shift) {
    try {
      await api.delete(`/shifts/${s.id}`);
      toast.success("Shift removed");
      loadRoster();
    } catch {
      toast.error("Could not delete shift.");
    }
  }

  function openAssign(userId: string, workDate: string) {
    if (!shifts.length) {
      toast.warning("Create a shift first, then assign staff.");
      return;
    }
    setAssignForm({ userId, shiftId: shifts[0]?.id ?? "", workDate });
    setAssignModal(true);
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/shifts/assign", {
        shiftId: assignForm.shiftId,
        userId: assignForm.userId,
        workDate: assignForm.workDate,
        branchId,
      });
      toast.success("Staff scheduled");
      setAssignModal(false);
      loadRoster();
    } catch (err: any) {
      toast.error(err?.message || "Could not assign. Check for conflicts.");
    }
  }

  async function removeAssignment(id: string) {
    try {
      await api.delete(`/shifts/assignment/${id}`);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Could not remove assignment.");
    }
  }

  async function cycleStatus(a: Assignment) {
    const next = STATUSES[(STATUSES.indexOf(a.status) + 1) % STATUSES.length];
    try {
      const res = await api.patch<{ status: string }>(`/shifts/assignment/${a.id}`, { status: next });
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: res.status } : x)));
    } catch {
      toast.error("Could not update status.");
    }
  }

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  return (
    <DashboardLayout title="Shifts" subtitle="Weekly roster — two shifts a day, per branch">
      <div className="space-y-6">
        <PageHeader
          title="Shift Roster"
          description="Assign staff to morning and afternoon shifts and track attendance status."
          icon={<CalendarDays className="w-5 h-5" />}
          actions={
            <div className="flex gap-2">
              <ExportMenu
                kind="shifts"
                filters={{
                  branchId,
                  from: days[0]?.toISOString(),
                  to: days[6]?.toISOString(),
                }}
              />
              <Button variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
                Print
              </Button>
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openAddShift}>
                Add Shift
              </Button>
            </div>
          }
        />

        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(weekStart, -7))} aria-label="Previous week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[15rem] text-center">
                <p className="text-sm font-semibold text-navy-900">
                  {dayLabel(days[0])} – {dayLabel(days[6])}
                </p>
                <p className="text-xs text-slate-500">{branchName || "No branch"}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setAnchor(addDays(weekStart, 7))} aria-label="Next week">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
            </div>
          </div>

          {/* Shift legend */}
          {shifts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-navy-800">{s.name}</span>
                  <span className="text-xs text-slate-500">{s.startTime}–{s.endTime}</span>
                  {s.isDefault && <Badge tone="navy">default</Badge>}
                  <button onClick={() => openEditShift(s)} className="ml-1 text-slate-400 hover:text-navy-700" aria-label="Edit shift">
                    <PencilLine className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteShift(s)} className="text-slate-400 hover:text-red-600" aria-label="Delete shift">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Roster grid */}
        {staff.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              {branchId ? "No active staff at this branch yet." : "Select a branch to build its roster."}
            </p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-navy-900">
                    Staff
                  </th>
                  {days.map((d, i) => (
                    <th key={i} className="border-b border-l border-slate-200 px-2 py-2.5 text-center font-medium text-slate-600">
                      {d.toLocaleDateString("en-NG", { weekday: "short" })}
                      <span className="block text-xs text-slate-400">{d.getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id} className="align-top">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 font-medium text-navy-900">
                      <p>{person.name}</p>
                      {person.jobTitle && <p className="text-xs font-normal text-slate-400">{person.jobTitle}</p>}
                    </td>
                    {days.map((d, i) => {
                      const key = `${person.id}|${ymd(d)}`;
                      const cellAssignments = cellMap[key] ?? [];
                      return (
                        <td key={i} className="border-b border-l border-slate-100 p-1.5">
                          <div className="space-y-1">
                            {cellAssignments.map((a) => (
                              <div
                                key={a.id}
                                className="group relative rounded-md border border-slate-200 px-1.5 py-1"
                              >
                                <button onClick={() => cycleStatus(a)} title="Click to change status" className="block w-full text-left">
                                  <span className="text-xs font-medium text-navy-800">{shiftById[a.shiftId]?.name ?? "Shift"}</span>
                                  <Badge tone={STATUS_TONE[a.status] ?? "slate"} className="ml-1 !px-1.5 !py-0 !text-[10px]">
                                    {a.status}
                                  </Badge>
                                </button>
                                <button
                                  onClick={() => removeAssignment(a.id)}
                                  className="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-slate-400 hover:text-red-600 group-hover:block"
                                  aria-label="Remove"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => openAssign(person.id, ymd(d))}
                              className="flex h-6 w-full items-center justify-center rounded-md text-slate-300 hover:bg-slate-50 hover:text-navy-600"
                              aria-label="Assign shift"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loading && <SkeletonList rows={4} />}
      </div>

      {/* Shift add/edit modal */}
      <Modal
        open={shiftModal}
        onClose={() => setShiftModal(false)}
        title={editingShift ? "Edit Shift" : "Add Shift"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShiftModal(false)}>Cancel</Button>
            <Button type="submit" form="shift-form" disabled={!shiftForm.name}>{editingShift ? "Update" : "Create"}</Button>
          </>
        }
      >
        <form id="shift-form" onSubmit={saveShift} className="space-y-4">
          <Input label="Name" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} required placeholder="e.g. Morning" />
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" label="Start" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} required />
            <Input type="time" label="End" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min="1" label="Min Staff" value={shiftForm.minStaff} onChange={(e) => setShiftForm({ ...shiftForm, minStaff: e.target.value })} />
            <Input type="number" min="1" label="Capacity (optional)" value={shiftForm.capacity} onChange={(e) => setShiftForm({ ...shiftForm, capacity: e.target.value })} placeholder="No limit" />
          </div>
          <Input label="Description (optional)" value={shiftForm.description} onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              checked={shiftForm.isDefault}
              onChange={(e) => setShiftForm({ ...shiftForm, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500/40"
            />
            Mark as the default shift for this branch
          </label>
        </form>
      </Modal>

      {/* Assign modal */}
      <Modal
        open={assignModal}
        onClose={() => setAssignModal(false)}
        title="Schedule Staff"
        description={`${staff.find((s) => s.id === assignForm.userId)?.name ?? ""} · ${assignForm.workDate}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button type="submit" form="assign-form" disabled={!assignForm.shiftId}>Assign</Button>
          </>
        }
      >
        <form id="assign-form" onSubmit={submitAssign} className="space-y-4">
          <Select label="Shift" value={assignForm.shiftId} onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })} required>
            <option value="">Select shift</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            Double-bookings on overlapping shifts and over-capacity assignments are blocked automatically.
          </p>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
