"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  ScanLine,
  Keyboard,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Camera,
  CameraOff,
  Users,
  ShieldCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Input,
  Select,
  Card,
  PageHeader,
  ExportMenu,
  SegmentedControl,
  StatTile,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";

interface BranchOption {
  id: string;
  name: string;
}
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

interface Result {
  ok: boolean;
  message: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CheckInTerminalPage() {
  const toast = useToast();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [staffCode, setStaffCode] = useState("");
  const [pin, setPin] = useState("");
  const [capturedToken, setCapturedToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const [onShift, setOnShift] = useState<AttendanceRecord[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);

  const loadBoard = useCallback(async () => {
    try {
      const data = await api.get<{ records: AttendanceRecord[] }>("/admin/attendance");
      setOnShift((data.records ?? []).filter((r) => r.status === "clocked_in"));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<{ branches: BranchOption[] }>("/admin/branches");
        setBranches(d.branches ?? []);
      } catch {
        /* non-fatal */
      }
    })();
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure the camera is released when leaving the page.
  useEffect(() => stopScan, []);

  async function startScan() {
    if (!videoRef.current) return;
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (decodedResult: any) => {
          if (decodedResult && decodedResult.getText) {
            const text = decodedResult.getText();
            if (text) {
              setCapturedToken(text);
              setResult({ ok: true, message: "Badge recognised — now enter the staff PIN." });
              stopScan();
            }
          }
        },
      );
      controlsRef.current = controls;
      setScanning(true);
      setResult(null);
    } catch {
      toast.error("Camera unavailable. Use manual staff-code entry.");
      setMode("manual");
    }
  }

  function stopScan() {
    try {
      controlsRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    setScanning(false);
  }

  function resetFeedback() {
    setResult(null);
    setCapturedToken("");
    setStaffCode("");
    setPin("");
  }

  async function submit(kind: "in" | "out") {
    if (!pin) {
      setResult({ ok: false, message: "The staff PIN is required." });
      return;
    }
    if (kind === "in" && !branchId) {
      setResult({ ok: false, message: "Select the branch terminal first." });
      return;
    }
    if (kind === "in" && !capturedToken && !staffCode) {
      setResult({ ok: false, message: "Scan a badge or enter a staff code." });
      return;
    }
    if (kind === "out" && !capturedToken && !staffCode) {
      setResult({ ok: false, message: "Scan a badge or enter a staff code." });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = { pin };
      if (capturedToken) payload.qrToken = capturedToken;
      else payload.staffCode = staffCode;
      if (kind === "in") {
        payload.branchId = branchId;
        if (typeof navigator !== "undefined") {
          payload.deviceInfo = navigator.userAgent.slice(0, 200);
        }
      }
      const endpoint = kind === "in" ? "/attendance/verify-clock" : "/attendance/verify-clock-out";
      const res = await api.post<{ message: string }>(endpoint, payload);
      setResult({ ok: true, message: res.message });
      toast.success(res.message);
      setCapturedToken("");
      setStaffCode("");
      setPin("");
      loadBoard();
    } catch (err: any) {
      const message = err?.message || "Verification failed.";
      setResult({ ok: false, message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedBranchName = branches.find((b) => b.id === branchId)?.name;
  const board = selectedBranchName
    ? onShift.filter((r) => r.branchName === selectedBranchName)
    : onShift;

  return (
    <DashboardLayout title="Check-in Terminal" subtitle="Anti-fraud staff attendance — badge + PIN">
      <div className="space-y-6">
        <PageHeader
          title="Staff Check-in Terminal"
          description="Identity is proven two ways: a physical badge (QR or staff code) and a secret PIN."
          icon={<ScanLine className="w-5 h-5" />}
          actions={<ExportMenu kind="attendance" />}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Terminal */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SegmentedControl
                  value={mode}
                  onChange={(v) => setMode(v)}
                  options={[
                    { value: "scan", label: "Scan Badge", icon: <ScanLine className="w-4 h-4" /> },
                    { value: "manual", label: "Manual Code", icon: <Keyboard className="w-4 h-4" /> },
                  ]}
                />
              </div>

              <Select
                label="Branch Terminal"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Select the branch you are clocking into…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>

              {mode === "scan" ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-xl bg-navy-900">
                    <video
                      ref={videoRef}
                      className="h-56 w-full object-cover"
                      muted
                      playsInline
                    />
                    {!scanning && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                        <Camera className="w-8 h-8" />
                        <span className="text-sm">Camera preview</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!scanning ? (
                      <Button variant="secondary" leftIcon={<Camera className="w-4 h-4" />} onClick={startScan}>
                        Start Scanner
                      </Button>
                    ) : (
                      <Button variant="outline" leftIcon={<CameraOff className="w-4 h-4" />} onClick={stopScan}>
                        Stop Scanner
                      </Button>
                    )}
                  </div>
                  {capturedToken ? (
                    <Badge tone="green" dot>
                      Badge scanned — PIN required
                    </Badge>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Point a staff badge at the camera. The scanned code is combined with the PIN below.
                    </p>
                  )}
                </div>
              ) : (
                <Input
                  label="Staff Code"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MQ-4F2A9C"
                  icon={<Keyboard className="w-4 h-4" />}
                />
              )}

              <Input
                label="Secret PIN"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="4–8 digits"
                hint="Stored as a bcrypt hash — never shown or sent back."
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  leftIcon={<LogIn className="w-4 h-4" />}
                  loading={submitting}
                  onClick={() => submit("in")}
                >
                  Clock In
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<LogOut className="w-4 h-4" />}
                  disabled={submitting}
                  onClick={() => submit("out")}
                >
                  Clock Out
                </Button>
                <Button variant="ghost" onClick={resetFeedback}>
                  Reset
                </Button>
              </div>

              {result && (
                <div
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    result.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {result.ok ? (
                    <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{result.message}</p>
                </div>
              )}
            </div>
          </Card>

          {/* On-shift board */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900">On Shift Now</h3>
                    <p className="text-xs text-slate-500">
                      {selectedBranchName ?? "All branches"} · live
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={loadBoard}>
                  Refresh
                </Button>
              </div>

              <StatTile
                icon={<ShieldCheck className="w-5 h-5" />}
                label="Clocked In"
                value={board.length}
                accent="green"
              />

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {board.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No one is clocked in{selectedBranchName ? ` at ${selectedBranchName}` : ""}.
                  </p>
                ) : (
                  board.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-navy-900">{r.staffName}</p>
                        <p className="text-xs text-slate-500">{r.branchName}</p>
                      </div>
                      <div className="text-right">
                        <Badge tone="green" dot>
                          In {fmtTime(r.clockIn)}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
