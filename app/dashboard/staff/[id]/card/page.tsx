"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import { Button, Badge, useToast } from "@/components/ui";
import { api, API_URL } from "@/lib/api/client";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "manager" | "staff";
  branchName: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  manager: "Branch Manager",
  staff: "Staff",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StaffCardPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = String(params?.id ?? "");

  const [member, setMember] = useState<StaffMember | null>(null);
  const [staffCode, setStaffCode] = useState("");
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, badge] = await Promise.all([
        api.get<{ staff: StaffMember[] }>("/admin/staff"),
        api.get<{ staffCode: string; dataUrl: string }>(`/admin/staff/${id}/badge-qr`),
      ]);
      setMember(list.staff?.find((s) => s.id === id) ?? null);
      setStaffCode(badge.staffCode);
      setQr(badge.dataUrl);
    } catch {
      toast.error("Could not load staff card.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function downloadPdf() {
    try {
      const res = await fetch(`${API_URL}/admin/staff/${id}/id-card.pdf`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `id-card-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the ID card PDF.");
    }
  }

  const fullName = member ? `${member.firstName} ${member.lastName}` : "";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          body { background: #fff; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl">
        {/* Controls (hidden when printing) */}
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.back()}>
            Back to Staff
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={downloadPdf}>
              Download PDF
            </Button>
            <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              Print Card
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading card…
          </div>
        ) : !member ? (
          <div className="py-24 text-center text-slate-500">Staff member not found.</div>
        ) : (
          <div className="space-y-6">
            {/* FRONT */}
            <div className="card-page mx-auto w-[340px] overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="bg-navy-900 px-4 pb-3 pt-3">
                <p className="text-sm font-bold tracking-wide text-white">MALIQUE OIL &amp; GAS LTD</p>
                <p className="text-[10px] font-medium text-amber-400">LPG · COOKING GAS</p>
              </div>
              <div className="h-1 w-full bg-amber-500" />
              <div className="flex gap-4 p-4">
                <div className="flex h-[74px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-navy-100 text-lg font-bold text-navy-700">
                  {initials(fullName) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-navy-900">{fullName}</p>
                  <p className="truncate text-xs text-slate-600">{ROLE_LABEL[member.role] ?? member.role}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{member.branchName}</p>
                  <p className="text-[11px] font-semibold text-navy-700">ID: {staffCode}</p>
                </div>
                {qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Badge QR" className="h-[52px] w-[52px] shrink-0" />
                )}
              </div>
              <div className="bg-slate-100 px-4 py-1.5 text-[9px] text-slate-500">
                Digital Identity Card · Valid while employed
              </div>
            </div>

            {/* BACK */}
            <div className="card-page mx-auto w-[340px] overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="bg-navy-800 px-4 py-2">
                <p className="text-xs font-bold text-white">Branch &amp; Contact Details</p>
              </div>
              <div className="flex gap-4 p-4">
                <div className="flex-1 space-y-3 text-[11px]">
                  <div>
                    <p className="font-bold uppercase tracking-wide text-navy-900">Branch</p>
                    <p className="text-slate-600">{member.branchName}</p>
                    <p className="text-slate-500">Rivers State, Nigeria</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wide text-navy-900">Hotline</p>
                    <p className="text-slate-600">+234 903 162 8721 · +234 915 597 7415</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wide text-navy-900">If found, return to</p>
                    <p className="leading-snug text-slate-500">
                      This card is the property of Malique Oil &amp; Gas Ltd. Report lost cards immediately.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-start">
                  {qr && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="Badge QR" className="h-[72px] w-[72px]" />
                  )}
                  <p className="mt-1 text-[9px] text-slate-400">Scan at check-in</p>
                </div>
              </div>
            </div>

            <div className="no-print flex justify-center">
              <Badge tone="navy">Preview mirrors the exported PDF. Use “Download PDF” for print-ready cards.</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
