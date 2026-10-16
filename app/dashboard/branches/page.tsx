"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  MapPin,
  Phone,
  Mail,
  PencilLine,
  Building2,
  UserRound,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  Badge,
  Button,
  Input,
  Modal,
  PageHeader,
  useToast,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/auth-context";

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  isActive: boolean;
  managerName?: string;
  createdAt: string;
}

// Rivers State is the operating region — default the city accordingly.
const DEFAULT_CITY = "Rivers State";

type FormState = {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  managerName: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  address: "",
  city: DEFAULT_CITY,
  phone: "",
  email: "",
  managerName: "",
  isActive: true,
};

export default function BranchesPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  // Mirrors @Roles('super_admin','admin') on the branch BFF writes.
  const canManage = useCan("super_admin", "admin");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    async function fetchBranches() {
      try {
        const data = await api.get<{ branches: Branch[] }>("/admin/branches");
        setBranches(data.branches ?? []);
      } catch {
        toast.error("Could not load branches. Please retry.");
      } finally {
        setLoading(false);
      }
    }
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAddModal() {
    setEditingBranch(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      address: branch.address,
      city: branch.city || DEFAULT_CITY,
      phone: branch.phone,
      email: branch.email,
      managerName: branch.managerName || "",
      isActive: branch.isActive,
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingBranch) {
        const updated = await api.patch<Branch>(
          `/admin/branches/${editingBranch.id}`,
          form,
        );
        setBranches((prev) =>
          prev.map((b) => (b.id === editingBranch.id ? { ...b, ...updated } : b)),
        );
        toast.success("Branch updated");
      } else {
        const created = await api.post<Branch>("/admin/branches", form);
        setBranches((prev) => [...prev, created]);
        toast.success("Branch created");
      }
      setShowModal(false);
    } catch (err) {
      toast.error("Failed to save branch. Please check the details and retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout title="Branches" subtitle="Manage your branch locations">
      <div className="space-y-6">
        <PageHeader
          title="Branch Locations"
          description="Your Rivers State branches — Igboh Etche and Elelenwo (Port-Harcourt)."
          icon={<Building2 className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <ExportMenu kind="branches" />
              {canManage && (
                <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                  Add Branch
                </Button>
              )}
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-3/4 rounded bg-slate-100" />
                </div>
              </Card>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">No branches yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Add your first branch to start assigning inventory, staff and orders.
              </p>
            </div>
            {canManage && (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                Add Branch
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <Card key={branch.id} hover className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-100">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-navy-900">
                        {branch.name}
                      </h3>
                      <p className="truncate text-xs text-slate-500">
                        {branch.city || "Rivers State"}
                      </p>
                    </div>
                  </div>
                  <Badge tone={branch.isActive ? "green" : "slate"} dot>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-slate-600">{branch.address || "—"}</p>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">{branch.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs truncate">{branch.email || "—"}</span>
                  </div>
                  {branch.managerName && (
                    <div className="flex items-center gap-2 border-t border-slate-100 pt-2 text-slate-500">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs">
                        Manager:{" "}
                        <span className="font-medium text-slate-700">
                          {branch.managerName}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(branch)}
                      leftIcon={<PencilLine className="w-3.5 h-3.5" />}
                    >
                      Edit Branch
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingBranch ? "Edit Branch" : "Add New Branch"}
        description="Branch details appear across inventory, staff and orders."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="branch-form"
              loading={saving}
              disabled={saving}
            >
              {editingBranch ? "Update Branch" : "Add Branch"}
            </Button>
          </>
        }
      >
        <form id="branch-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Branch Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. Igboh Etche"
          />
          <Input
            label="Address"
            name="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            placeholder="Street address"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="City / Area"
              name="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
            <Input
              label="Phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              placeholder="+234…"
            />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="branch@malique.com"
          />
          <Input
            label="Manager Name"
            name="managerName"
            value={form.managerName}
            onChange={(e) => setForm({ ...form, managerName: e.target.value })}
            placeholder="Branch manager name"
          />
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-navy-800">Branch is active</span>
          </label>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
