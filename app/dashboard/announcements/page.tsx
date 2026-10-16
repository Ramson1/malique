"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  PencilLine,
  Trash2,
  Megaphone,
  Pin,
  PinOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  FilterBar,
  PageHeader,
  DataGrid,
  type Column,
  type FilterField,
  useToast,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useCan } from "@/lib/auth-context";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  pinned: boolean;
  linkLabel?: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  general: "General Update",
  stock: "Stock Availability",
  promo: "Promo / Offer",
  price: "Price News",
  news: "News",
};

const TYPE_TONES: Record<string, "slate" | "red" | "amber" | "blue" | "purple"> = {
  general: "slate",
  stock: "red",
  promo: "amber",
  price: "blue",
  news: "purple",
};

const STATUS_TONES: Record<string, "slate" | "green" | "neutral"> = {
  draft: "slate",
  published: "green",
  archived: "neutral",
};

type FormState = {
  title: string;
  body: string;
  type: string;
  status: string;
  pinned: boolean;
  linkLabel: string;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  type: "general",
  status: "published",
  pinned: false,
  linkLabel: "",
  linkUrl: "",
  startsAt: "",
  endsAt: "",
};

// Convert an ISO string to a value usable by <input type="datetime-local">.
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AnnouncementsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({
    search: "",
    status: "",
    type: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  // Mirrors @Roles('super_admin','admin','branch_manager') on the announcements BFF writes.
  const canManage = useCan("super_admin", "admin", "branch_manager");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ announcements: Announcement[] }>(
        "/admin/announcements",
      );
      setItems(data.announcements ?? []);
    } catch {
      toast.error("Could not load announcements. Please retry.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  useEffect(() => {
    load();
  }, []);

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "search", type: "search", placeholder: "Search announcements…" },
      {
        key: "status",
        type: "select",
        label: "All Statuses",
        options: [
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
          { value: "archived", label: "Archived" },
        ],
      },
      {
        key: "type",
        type: "select",
        label: "All Types",
        options: Object.entries(TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
    ],
    [],
  );

  const filtered = items.filter((a) => {
    const q = filters.search.toLowerCase();
    const matchesSearch =
      !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    const matchesStatus = !filters.status || a.status === filters.status;
    const matchesType = !filters.type || a.type === filters.type;
    return matchesSearch && matchesStatus && matchesType;
  });

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      type: a.type,
      status: a.status,
      pinned: a.pinned,
      linkLabel: a.linkLabel ?? "",
      linkUrl: a.linkUrl ?? "",
      startsAt: toLocalInput(a.startsAt),
      endsAt: toLocalInput(a.endsAt),
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        body: form.body,
        type: form.type,
        status: form.status,
        pinned: form.pinned,
        linkLabel: form.linkLabel || undefined,
        linkUrl: form.linkUrl || undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      };
      if (editing) {
        const updated = await api.patch<Announcement>(
          `/admin/announcements/${editing.id}`,
          payload,
        );
        setItems((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
        toast.success("Announcement updated");
      } else {
        const created = await api.post<Announcement>(
          "/admin/announcements",
          payload,
        );
        setItems((prev) => [created, ...prev]);
        toast.success("Announcement created");
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save. Please check the details.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: Announcement) {
    const next = a.status === "published" ? "draft" : "published";
    try {
      const updated = await api.patch<Announcement>(
        `/admin/announcements/${a.id}`,
        { status: next },
      );
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      toast.success(next === "published" ? "Published to website" : "Moved to draft");
    } catch {
      toast.error("Could not change status.");
    }
  }

  async function togglePin(a: Announcement) {
    try {
      const updated = await api.patch<Announcement>(
        `/admin/announcements/${a.id}`,
        { pinned: !a.pinned },
      );
      setItems((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch {
      toast.error("Could not update pin.");
    }
  }

  async function handleDelete(a: Announcement) {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/announcements/${a.id}`);
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Announcement deleted");
    } catch {
      toast.error("Could not delete announcement.");
    }
  }

  const columns: Column<Announcement>[] = [
    {
      key: "title",
      header: "Announcement",
      sortable: true,
      accessor: (a) => a.title,
      render: (a) => (
        <div className="min-w-[220px]">
          <div className="flex items-center gap-1.5">
            {a.pinned && (
              <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
            )}
            <span className="font-semibold text-navy-900">{a.title}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{a.body}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (a) => (
        <Badge tone={TYPE_TONES[a.type] ?? "slate"}>{TYPE_LABELS[a.type] ?? a.type}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <Badge tone={STATUS_TONES[a.status] ?? "neutral"} dot>
          <span className="capitalize">{a.status}</span>
        </Badge>
      ),
    },
    {
      key: "window",
      header: "Active Window",
      render: (a) => (
        <span className="text-xs text-slate-500">
          {a.startsAt || a.endsAt
            ? `${formatDate(a.startsAt)} → ${a.endsAt ? formatDate(a.endsAt) : "ongoing"}`
            : "Always"}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortable: true,
      accessor: (a) => new Date(a.updatedAt).getTime(),
      render: (a) => (
        <span className="text-xs text-slate-500">{formatDate(a.updatedAt)}</span>
      ),
    },
  ];

  return (
    <DashboardLayout
      title="Announcements"
      subtitle="Publish updates, stock alerts and promos to the website"
    >
      <div className="space-y-6">
        <PageHeader
          title="Website Announcements"
          description="What you publish here appears on the Malique website — gas availability, promo prices and the latest news."
          icon={<Megaphone className="w-5 h-5" />}
          actions={
            canManage ? (
              <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
                New Announcement
              </Button>
            ) : undefined
          }
        />

        <FilterBar
          fields={filterFields}
          values={filters}
          onChange={setFilter}
          onReset={() => setFilters({ search: "", status: "", type: "" })}
          right={
            <ExportMenu
              kind="announcements"
              filters={{ search: filters.search, status: filters.status, type: filters.type }}
            />
          }
        />

        <DataGrid
          columns={columns}
          rows={filtered}
          loading={loading}
          getRowId={(a) => a.id}
          defaultSort={{ key: "updated", dir: "desc" }}
          emptyTitle="No announcements yet"
          emptyHint="Create your first announcement to keep customers informed on the website."
          emptyIcon={<Megaphone className="h-6 w-6" />}
          rowActions={(a) =>
            canManage ? (
              <>
              <Button
                variant="ghost"
                size="icon"
                title={a.pinned ? "Unpin" : "Pin to top"}
                onClick={() => togglePin(a)}
              >
                {a.pinned ? (
                  <PinOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Pin className="w-4 h-4 text-slate-400" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={a.status === "published" ? "Unpublish" : "Publish"}
                onClick={() => togglePublish(a)}
              >
                {a.status === "published" ? (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Eye className="w-4 h-4 text-emerald-600" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Edit"
                onClick={() => openEditModal(a)}
              >
                <PencilLine className="w-4 h-4 text-slate-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete"
                onClick={() => handleDelete(a)}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
              </>
            ) : null
          }
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Announcement" : "New Announcement"}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="announcement-form" loading={saving} disabled={saving}>
              {editing ? "Save Changes" : "Create"}
            </Button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="Title"
            name="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Cylinder refill price update"
            required
          />
          <Textarea
            label="Message"
            name="body"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={4}
            placeholder="What customers should know…"
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              name="type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              name="status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="published">Published (visible on website)</option>
              <option value="draft">Draft (hidden)</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Link Label (optional)"
              name="linkLabel"
              value={form.linkLabel}
              onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
              placeholder="e.g. Order now"
            />
            <Input
              label="Link URL (optional)"
              name="linkUrl"
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="/order or https://…"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Shows From (optional)"
              name="startsAt"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
            <Input
              label="Shows Until (optional)"
              name="endsAt"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            Pin to top of the website feed
          </label>
          <p className="text-xs text-slate-400">
            Leave the window blank to keep the announcement visible until you unpublish it.
          </p>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
