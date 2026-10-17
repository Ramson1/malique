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
  super_admin: "Super Administrator",
  admin: "Administrator",
  branch_manager: "Branch Manager",
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
            {/* FRONT — portrait */}
            <div className="card-page mx-auto flex w-[260px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
              <div className="bg-[#0A1628] px-3 pb-2 pt-3 text-center">
                <p className="text-[11px] font-bold tracking-wide text-white">MALIQUE OIL &amp; GAS LTD</p>
                <p className="mt-0.5 text-[7px] font-medium tracking-[0.2em] text-[#e6c583]">LPG · COOKING GAS · ENERGY</p>
              </div>
              <div className="h-[3px] w-full bg-[#D4A853]" />
              <div className="flex flex-1 flex-col items-center px-4 pb-2">
                <div className="-mt-6 flex h-11 w-11 items-center justify-center rounded-full bg-[#192842] ring-2 ring-[#D4A853]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#D4A853]" aria-hidden="true">
                    <path d="M12 2c3 5 6 7 6 11a6 6 0 1 1-12 0c0-4 3-6 6-11z" />
                  </svg>
                </div>
                <div className="mt-2 flex h-[92px] w-[80px] items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-2xl font-bold text-[#263c63] ring-1 ring-[#D4A853]">
                  {initials(fullName) || "?"}
                </div>
                <p className="mt-2 w-full truncate text-center text-[13px] font-bold text-[#0A1628]">{fullName}</p>
                <p className="text-center text-[8px] font-bold uppercase tracking-wider text-[#263c63]">{ROLE_LABEL[member.role] ?? member.role}</p>
                <div className="my-2 h-px w-4/5 bg-slate-200" />
                <div className="rounded-md p-1 ring-1 ring-[#192842]">
                  {qr && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="Badge QR" className="h-[74px] w-[74px]" />
                  )}
                </div>
                <p className="mt-1 text-center text-[7px] tracking-wide text-slate-400">SCAN FOR SHIFT CHECK-IN / CHECK-OUT</p>
                <p className="mt-2 w-full truncate text-center text-[9px] font-bold text-[#0A1628]">BRANCH: {member.branchName}</p>
                <p className="text-center text-[8px] text-slate-600">ID · {staffCode}</p>
              </div>
              <div className="bg-[#0A1628] py-1 text-center text-[7px] tracking-[0.15em] text-[#e6c583]">
                STAFF IDENTITY CARD · VALID WHILE EMPLOYED
              </div>
            </div>

            {/* BACK — portrait */}
            <div className="card-page mx-auto flex w-[260px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
              <div className="bg-[#192842] px-3 py-2 text-center">
                <p className="text-[10px] font-bold tracking-wide text-white">MALIQUE OIL &amp; GAS LTD</p>
                <p className="text-[7px] tracking-[0.15em] text-[#e6c583]">EMPLOYEE CARD · TERMS &amp; COMPANY DETAILS</p>
              </div>
              <div className="h-[2px] w-full bg-[#D4A853]" />
              <div className="flex-1 space-y-3 px-4 py-3 text-[9px]">
                <div>
                  <p className="font-bold uppercase tracking-wide text-[#b98a3a]">Property &amp; Custody</p>
                  <p className="mt-0.5 leading-snug text-slate-600">
                    This card is the property of Malique Oil &amp; Gas Ltd. Use is governed by company policy and it must be surrendered on resignation or termination. If found, return it to the nearest branch.
                  </p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wide text-[#b98a3a]">Branch</p>
                  <p className="text-slate-600">{member.branchName} — Rivers State, Nigeria</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wide text-[#b98a3a]">Company Contact</p>
                  <p className="text-slate-600">+234 903 162 8721 · +234 915 597 7415 · +234 903 056 8003</p>
                  <p className="text-slate-600">maliqueoilandgasltd@gmail.com</p>
                </div>
              </div>
              {/* Designer / developer credit */}
              <div className="mt-auto bg-[#0A1628] px-3 py-3 text-center ring-1 ring-inset ring-[#D4A853]">
                <p className="text-[7px] uppercase tracking-[0.2em] text-slate-300">Designed &amp; Developed by</p>
                <p className="text-[14px] font-bold tracking-[0.15em] text-[#D4A853]">BLACK-BOX TECH</p>
                <p className="text-[9px] text-white">info@blackboxtech.online</p>
              </div>
            </div>

            <div className="no-print flex justify-center">
              <Badge tone="navy">Portrait preview mirrors the exported PDF. Use “Download PDF” for print-ready cards.</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
