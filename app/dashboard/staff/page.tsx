"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PencilLine,
  Shield,
  UserCog,
  Power,
  ScanLine,
  QrCode,
  Printer,
  Download,
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
import { api, API_URL } from "@/lib/api/client";
import { useCan } from "@/lib/auth-context";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "admin" | "manager" | "staff" | "rider";
  branchName: string;
  isActive: boolean;
  jobTitle?: string;
  baseSalary?: number | null;
  staffCode?: string;
  lastLogin: string;
  createdAt: string;
}

const ROLE_TONE: Record<string, "red" | "blue" | "slate" | "green"> = {
  admin: "red",
  manager: "blue",
  staff: "slate",
  rider: "green",
};

// Human-friendly labels. `staff` is the Secretary / POS role; `rider` is the
// delivery partner. `super_admin` is intentionally never offered for creation.
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Secretary",
  rider: "Rider",
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: StaffMember["role"];
  branchName: string;
  jobTitle: string;
  baseSalary: string;
  password: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "staff",
  branchName: "",
  jobTitle: "",
  baseSalary: "",
  password: "",
};

export default function StaffPage() {
  const toast = useToast();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    role: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  // Mirrors @Roles('super_admin','admin','branch_manager') on the staff BFF writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Check-in credentials (staff code + PIN + badge QR)
  const [credStaff, setCredStaff] = useState<StaffMember | null>(null);
  const [credCode, setCredCode] = useState("");
  const [credPin, setCredPin] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [badgeUrl, setBadgeUrl] = useState("");

  useEffect(() => {
    async function fetchStaff() {
      try {
        const data = await api.get<{ staff: StaffMember[] }>("/admin/staff");
        setStaff(data.staff ?? []);
      } catch {
        toast.error("Could not load staff. Please retry.");
      } finally {
        setLoading(false);
      }
    }
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search by name, email or role…" },
      {
        key: "role",
        type: "select",
        label: "All Roles",
        options: [
          { value: "admin", label: "Admin" },
          { value: "manager", label: "Manager" },
          { value: "staff", label: "Secretary" },
          { value: "rider", label: "Rider" },
        ],
      },
    ],
    [],
  );

  const filtered = staff.filter((s) => {
    const q = filters.search.toLowerCase();
    const matchSearch =
      !q ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.role.includes(q);
    const matchRole = !filters.role || s.role === filters.role;
    return matchSearch && matchRole;
  });

  function openAddModal() {
    setEditingStaff(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      role: member.role,
      branchName: member.branchName,
      jobTitle: member.jobTitle ?? "",
      baseSalary: member.baseSalary != null ? String(member.baseSalary) : "",
      password: "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingStaff) {
        const updated = await api.patch<StaffMember>(`/admin/staff/${editingStaff.id}`, form);
        setStaff((prev) => prev.map((s) => (s.id === editingStaff.id ? updated : s)));
        toast.success("Staff updated");
      } else {
        const created = await api.post<StaffMember>("/admin/staff", form);
        setStaff((prev) => [...prev, created]);
        toast.success("Staff added");
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save staff member.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: StaffMember) {
    try {
      await api.patch(`/admin/staff/${member.id}`, { isActive: !member.isActive });
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, isActive: !s.isActive } : s)),
      );
      toast.success(member.isActive ? "Staff deactivated" : "Staff activated");
    } catch {
      toast.error("Failed to update staff status.");
    }
  }

  function openCredModal(member: StaffMember) {
    setCredStaff(member);
    setCredCode("");
    setCredPin("");
    setBadgeUrl("");
  }

  async function saveCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!credStaff) return;
    setCredSaving(true);
    try {
      const res = await api.post<{ staffCode: string; pinSet: boolean }>(
        `/admin/staff/${credStaff.id}/checkin`,
        { staffCode: credCode || undefined, pin: credPin || undefined },
      );
      setCredCode(res.staffCode);
      toast.success(
        res.pinSet ? "Staff code & PIN saved" : "Staff code saved (no PIN set)",
      );
      setBadgeUrl("");
    } catch {
      toast.error("Failed to save check-in credentials.");
    } finally {
      setCredSaving(false);
    }
  }

  async function generateBadge() {
    if (!credStaff) return;
    try {
      const res = await api.get<{ staffCode: string; dataUrl: string }>(
        `/admin/staff/${credStaff.id}/badge-qr`,
      );
      setCredCode(res.staffCode);
      setBadgeUrl(res.dataUrl);
    } catch {
      toast.error("Could not generate badge QR.");
    }
  }

  // Authenticated blob download (API is cross-origin, cookie-based auth).
  async function downloadAllCards() {
    try {
      const res = await fetch(`${API_URL}/admin/staff/id-cards.pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "malique-id-cards.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ID cards PDF downloaded.");
    } catch {
      toast.error("Could not export ID cards.");
    }
  }

  const columns: Column<StaffMember>[] = [
    {
      key: "staff",
      header: "Staff",
      sortable: true,
      sortValue: (r) => `${r.firstName} ${r.lastName}`,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
            {`${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy-900">
              {m.firstName} {m.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (r) => r.role,
      render: (m) => (
        <Badge tone={ROLE_TONE[m.role] ?? "slate"}>
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {ROLE_LABEL[m.role] ?? m.role}
          </span>
        </Badge>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (m) => <span className="text-sm text-slate-500">{m.branchName}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (m) => (
        <Badge tone={m.isActive ? "green" : "slate"} dot>
          {m.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout title="Staff" subtitle="Manage staff accounts and permissions">
      <div className="space-y-6">
        <PageHeader
          title="Staff Management"
          description="Admins, branch managers and staff across your Rivers State branches."
          icon={<UserCog className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={downloadAllCards}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export ID Cards
              </Button>
              {canManage && (
                <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                  Add Staff
                </Button>
              )}
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatTile
            icon={<Shield className="w-5 h-5" />}
            label="Admins"
            value={staff.filter((s) => s.role === "admin").length}
            accent="red"
          />
          <StatTile
            icon={<UserCog className="w-5 h-5" />}
            label="Managers"
            value={staff.filter((s) => s.role === "manager").length}
            accent="blue"
          />
          <StatTile
            icon={<UserCog className="w-5 h-5" />}
            label="Secretaries"
            value={staff.filter((s) => s.role === "staff").length}
            accent="navy"
          />
          <StatTile
            icon={<UserCog className="w-5 h-5" />}
            label="Riders"
            value={staff.filter((s) => s.role === "rider").length}
            accent="green"
          />
        </div>

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters({ search: "", role: "" })}
          right={<ExportMenu kind="staff" filters={{ search: filters.search, role: filters.role }} />}
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(r) => r.id}
          emptyTitle="No staff found"
          emptyHint="Adjust your search or add a new staff member."
          rowActions={(m) => (
            <div className="inline-flex items-center gap-1">
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(m)}
                  aria-label="Edit"
                >
                  <PencilLine className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/dashboard/staff/${m.id}/card`)}
                aria-label="View ID card"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openCredModal(m)}
                aria-label="Check-in credentials"
              >
                <ScanLine className="h-4 w-4" />
              </Button>
              <Button
                variant={m.isActive ? "outline" : "success"}
                size="sm"
                onClick={() => toggleActive(m)}
                leftIcon={<Power className="w-3.5 h-3.5" />}
              >
                {m.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          )}
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingStaff ? "Edit Staff" : "Add New Staff"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" loading={saving} disabled={saving}>
              {editingStaff ? "Update Staff" : "Add Staff"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSave} className="space-y-4">
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
              label="Role"
              name="role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as StaffMember["role"] })
              }
            >
              <option value="staff">Secretary (POS)</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="rider">Rider</option>
            </Select>
          </div>
          <Input
            label="Branch"
            name="branchName"
            value={form.branchName}
            onChange={(e) => setForm({ ...form, branchName: e.target.value })}
            required
            placeholder="Assigned branch"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Job Title"
              name="jobTitle"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="e.g. Pump Attendant"
            />
            <Input
              label="Base Salary (₦)"
              name="baseSalary"
              type="number"
              min="0"
              value={form.baseSalary}
              onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
              placeholder="Used for payroll generation"
            />
          </div>
          {!editingStaff && (
            <Input
              label="Temporary Password"
              name="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder="Set initial password"
            />
          )}
        </form>
      </Modal>

      <Modal
        open={!!credStaff}
        onClose={() => setCredStaff(null)}
        title="Check-in Credentials"
        description={credStaff ? `${credStaff.firstName} ${credStaff.lastName}` : undefined}
        footer={
          <Button variant="outline" onClick={() => setCredStaff(null)}>
            Close
          </Button>
        }
      >
        {credStaff && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Assign a staff code and secret PIN for the anti-fraud check-in
              terminal. The code identifies the person; the PIN is what they
              memorise. Neither is stored in plain text.
            </p>
            <form onSubmit={saveCheckin} className="space-y-4">
              <Input
                label="Staff Code"
                value={credCode}
                onChange={(e) => setCredCode(e.target.value.toUpperCase())}
                placeholder="Auto-generated if left blank"
              />
              <Input
                label="Set / Rotate PIN"
                type="password"
                inputMode="numeric"
                value={credPin}
                onChange={(e) => setCredPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="4–8 digits (leave blank to keep current)"
              />
              <Button type="submit" loading={credSaving} disabled={credSaving}>
                Save Credentials
              </Button>
            </form>
            <div className="border-t border-slate-200 pt-4">
              <Button
                variant="secondary"
                onClick={generateBadge}
                leftIcon={<QrCode className="w-4 h-4" />}
              >
                Generate Badge QR
              </Button>
              {badgeUrl && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeUrl}
                    alt={`Badge QR for ${credStaff.firstName}`}
                    className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2"
                  />
                  <p className="text-xs text-slate-500">Code: {credCode}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
