"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Inbox,
  Mail,
  Phone,
  User,
  Clock,
  Send,
  CheckCheck,
  Archive,
  Tag,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Textarea,
  Card,
  Drawer,
  PageHeader,
  SegmentedControl,
  SkeletonList,
  useToast,
  ExportMenu,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface Message {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  source: string;
  status: "new" | "read" | "replied" | "archived";
  relatedOrderId?: string;
  repliedAt?: string;
  response?: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, "red" | "amber" | "green" | "slate"> = {
  new: "red",
  read: "amber",
  replied: "green",
  archived: "slate",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
];

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function MessagesPage() {
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : "";
      const d = await api.get<{ messages: Message[] }>(`/admin/messages${q}`);
      setMessages(d.messages ?? []);
    } catch {
      toast.error("Could not load messages.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openMessage(m: Message) {
    setSelected(m);
    setReply(m.response ?? "");
    // Fetch full detail (this also flips "new" to "read" on the server).
    try {
      const detail = await api.get<Message>(`/admin/messages/${m.id}`);
      setSelected(detail);
      if (m.status === "new") {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: detail.status } : x)));
      }
    } catch {
      /* keep list data */
    }
  }

  async function setStatus(status: Message["status"]) {
    if (!selected) return;
    try {
      const updated = await api.patch<Message>(`/admin/messages/${selected.id}`, { status });
      setSelected(updated);
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(`Marked ${status}.`);
    } catch {
      toast.error("Could not update status.");
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim()) {
      toast.error("Write a reply first.");
      return;
    }
    setSending(true);
    try {
      const updated = await api.post<Message & { emailSent: boolean }>(
        `/admin/messages/${selected.id}/reply`,
        { response: reply },
      );
      setSelected(updated);
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(updated.emailSent ? "Reply sent by email." : "Reply recorded (no email address).");
    } catch (err: any) {
      toast.error(err?.message || "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  const newCount = messages.filter((m) => m.status === "new").length;

  return (
    <DashboardLayout title="Messages" subtitle="Customer enquiries and communication inbox">
      <div className="space-y-6">
        <PageHeader
          title="Communication Inbox"
          description="Read, reply to and organise messages from the website contact form and staff."
          icon={<Inbox className="w-5 h-5" />}
          actions={newCount > 0 ? <Badge tone="red">{newCount} new</Badge> : undefined}
        />

        <div className="flex items-center justify-between gap-3">
          <SegmentedControl options={FILTERS} value={filter} onChange={(v) => setFilter(v)} />
          <ExportMenu kind="messages" filters={{ status: filter }} />
        </div>

        <Card padded={false}>
          {loading ? (
            <div className="p-6">
              <SkeletonList rows={5} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-navy-900">No messages</p>
              <p className="max-w-sm text-xs text-slate-500">
                New enquiries submitted through the website will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => openMessage(m)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${m.status === "new" ? "bg-red-500" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-navy-900">
                          {m.subject || m.message.slice(0, 60)}
                        </p>
                        <Badge tone={STATUS_TONE[m.status] ?? "slate"}>{m.status}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{m.message}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" /> {m.name ?? "Anonymous"}
                        </span>
                        {m.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {m.email}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {fmt(m.createdAt)}
                        </span>
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Detail + reply drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject || "Message"}
        description={selected ? fmt(selected.createdAt) : ""}
        width="lg"
        footer={
          selected && (
            <>
              <Button variant="ghost" leftIcon={<Archive className="w-4 h-4" />} onClick={() => setStatus("archived")}>
                Archive
              </Button>
              {selected.status !== "read" && selected.status !== "replied" && (
                <Button variant="outline" leftIcon={<CheckCheck className="w-4 h-4" />} onClick={() => setStatus("read")}>
                  Mark Read
                </Button>
              )}
              <Button leftIcon={<Send className="w-4 h-4" />} onClick={sendReply} loading={sending}>
                Send Reply
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={STATUS_TONE[selected.status] ?? "slate"}>{selected.status}</Badge>
              <Badge tone="navy">
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {selected.source}
                </span>
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p className="text-slate-600">
                <span className="font-medium text-navy-900">From:</span> {selected.name ?? "Anonymous"}
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-navy-900">Email:</span>{" "}
                {selected.email ? (
                  <a href={`mailto:${selected.email}`} className="text-navy-700 hover:underline">
                    {selected.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p className="text-slate-600">
                <span className="inline-flex items-center gap-1 font-medium text-navy-900">
                  <Phone className="h-3 w-3" /> Phone:
                </span>{" "}
                {selected.phone ?? "—"}
              </p>
              {selected.repliedAt && (
                <p className="text-slate-600">
                  <span className="font-medium text-navy-900">Replied:</span> {fmt(selected.repliedAt)}
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Message</p>
              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-navy-800">
                {selected.message}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Reply</p>
              <Textarea
                rows={5}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  selected.email
                    ? "Type your reply — it will be emailed to the customer."
                    : "No email on this message; the reply is recorded in the thread only."
                }
              />
            </div>
          </div>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
