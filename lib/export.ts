import { API_URL } from "@/lib/api/client";

// A single, robust export path shared by every admin page. Reports are built
// server-side (PDF/Excel/Word/CSV) by ReportsService so the downloaded file
// matches the on-screen, filtered table exactly and carries branding.
//
// We download via fetch + blob (NOT a plain <a href>) so the cross-site
// SameSite=None auth cookie is always sent and the server's branded
// Content-Disposition filename is preserved.

export type ExportFormat = "pdf" | "xlsx" | "docx" | "csv";

export const ALL_FORMATS: ExportFormat[] = ["pdf", "xlsx", "docx", "csv"];

export type ExportFilters = Record<string, string | undefined>;

function buildQuery(format: ExportFormat, filters: ExportFilters): string {
  const qs = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") qs.set(key, value);
  }
  return qs.toString();
}

export function exportHref(kind: string, format: ExportFormat, filters: ExportFilters = {}): string {
  return `${API_URL}/admin/reports/${kind}?${buildQuery(format, filters)}`;
}

export async function downloadReport(
  kind: string,
  format: ExportFormat,
  filters: ExportFilters = {},
): Promise<string> {
  return downloadUrl(exportHref(kind, format, filters));
}

// Branded single documents: /admin/reports/invoice/:id and .../manifest/:id.
export function invoiceHref(orderId: string): string {
  return `${API_URL}/admin/reports/invoice/${orderId}`;
}

export function manifestHref(deliveryId: string): string {
  return `${API_URL}/admin/reports/manifest/${deliveryId}`;
}

export async function downloadInvoice(orderId: string): Promise<string> {
  return downloadUrl(invoiceHref(orderId));
}

export async function downloadManifest(deliveryId: string): Promise<string> {
  return downloadUrl(manifestHref(deliveryId));
}

async function downloadUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || "Export failed");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "document.pdf";
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
  return filename;
}
