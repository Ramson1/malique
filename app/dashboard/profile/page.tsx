"use client";

import { useEffect, useRef, useState } from "react";
import {
  UserRound,
  KeyRound,
  Camera,
  Loader2,
  Mail,
  Save,
  ShieldAlert,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardHeader,
  Button,
  Input,
  Badge,
  PageHeader,
  SkeletonCard,
  useToast,
} from "@/components/ui";
import { api, API_URL } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";

interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  avatarUrl?: string;
  staffCode?: string | null;
  jobTitle?: string | null;
  branch?: { name?: string } | null;
  createdAt?: string;
}

export default function ProfilePage() {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({ fullName: "", phone: "" });

  // Change-password state
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changing, setChanging] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const p = await api.get<Profile>("/auth/staff/profile");
        setProfile(p);
        setForm({ fullName: p.fullName ?? "", phone: p.phone ?? "" });
        setResetEmail(p.email ?? "");
      } catch (e) {
        toast.error((e as Error).message || "Could not load your profile");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/upload?folder=avatars`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      const url = json.url as string;
      await api.post("/auth/staff/avatar", { url });
      setProfile((p) => (p ? { ...p, avatarUrl: url } : p));
      await refreshUser();
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error((err as Error).message || "Could not upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch("/auth/staff/profile", {
        fullName: form.fullName,
        phone: form.phone || undefined,
      });
      await refreshUser();
      toast.success("Profile saved");
    } catch (err) {
      toast.error((err as Error).message || "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (pw.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setChanging(true);
    try {
      await api.post("/auth/staff/change-password", {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error((err as Error).message || "Could not change password");
    } finally {
      setChanging(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setSendingReset(true);
    try {
      await api.post("/auth/forgot-password", { email: resetEmail });
      toast.success("Password reset email sent (if the address exists)");
    } catch (err) {
      toast.error((err as Error).message || "Could not send reset email");
    } finally {
      setSendingReset(false);
    }
  }

  const initials =
    (profile?.fullName ?? "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A";

  return (
    <DashboardLayout title="Profile" subtitle="Manage your account, photo and password">
      <div className="space-y-6">
        <PageHeader
          title="Your Account"
          description="Update your personal details, upload a profile photo and manage your password."
          icon={<UserRound className="w-5 h-5" />}
        />

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* Identity */}
            <Card>
              <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
                <div className="relative w-24 h-24 shrink-0">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="w-24 h-24 rounded-full object-cover ring-2 ring-amber-500/30"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-navy-900 flex items-center justify-center text-2xl font-bold text-amber-400">
                      {initials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-white hover:bg-amber-600 transition-colors disabled:opacity-60"
                    aria-label="Change photo"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-navy-900">
                      {profile?.fullName || "—"}
                    </h3>
                    <Badge tone="amber" dot>
                      {(profile?.role ?? "admin").replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">{profile?.email}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    {profile?.branch?.name && <span>Branch: {profile.branch.name}</span>}
                    {profile?.staffCode && <span>Staff Code: {profile.staffCode}</span>}
                    {profile?.jobTitle && <span>Title: {profile.jobTitle}</span>}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Edit profile */}
              <Card>
                <form onSubmit={saveProfile} className="space-y-4">
                  <CardHeader
                    title="Personal Details"
                    subtitle="Your name and contact number"
                    icon={<UserRound className="w-5 h-5" />}
                  />
                  <Input
                    label="Full name"
                    name="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. Chidi Okafor"
                  />
                  <Input
                    label="Phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+234 …"
                  />
                  <Input label="Email" value={profile?.email ?? ""} disabled hint="Email is managed by an administrator." />
                  <Button type="submit" loading={savingProfile} leftIcon={<Save className="w-4 h-4" />}>
                    Save changes
                  </Button>
                </form>
              </Card>

              {/* Change password */}
              <Card>
                <form onSubmit={changePassword} className="space-y-4">
                  <CardHeader
                    title="Change Password"
                    subtitle="Enter your current password and a new one"
                    icon={<KeyRound className="w-5 h-5" />}
                  />
                  <Input
                    label="Current password"
                    type="password"
                    name="currentPassword"
                    autoComplete="current-password"
                    value={pw.currentPassword}
                    onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                  />
                  <Input
                    label="New password"
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    value={pw.newPassword}
                    onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={pw.confirmPassword}
                    onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                  <Button type="submit" variant="secondary" loading={changing} leftIcon={<ShieldAlert className="w-4 h-4" />}>
                    Update password
                  </Button>
                </form>
              </Card>
            </div>

            {/* Recovery */}
            <Card>
              <form onSubmit={sendReset} className="space-y-4">
                <CardHeader
                  title="Password Recovery"
                  subtitle="Forgot your current password? Email yourself a secure reset link."
                  icon={<Mail className="w-5 h-5" />}
                />
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <Input
                    label="Send reset link to"
                    type="email"
                    name="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="sm:max-w-sm"
                  />
                  <Button type="submit" variant="outline" loading={sendingReset} leftIcon={<Mail className="w-4 h-4" />}>
                    Send reset email
                  </Button>
                </div>
              </form>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
