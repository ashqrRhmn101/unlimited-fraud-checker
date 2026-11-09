import { apiGuard } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { listCustomersForExport } from "@/lib/repo";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET /api/customers/export — CSV (opens in Excel with Bangla text intact) */
export async function GET() {
  const denied = await apiGuard();
  if (denied) return denied;

  const customers = await listCustomersForExport();
  const header = [
    "Name",
    "Phone",
    "Address",
    "Area",
    "City",
    "Total Parcels",
    "Delivered",
    "Returned/Cancelled",
    "Success Rate %",
    "Trust Tier",
    "Last Checked",
    "Source",
  ];
  const lines = customers.map((customer) =>
    [
      customer.name,
      formatPhone(customer.phone),
      customer.address,
      customer.area,
      customer.city,
      customer.checkTotal,
      customer.checkDelivered,
      customer.checkCancelled,
      customer.checkRate,
      customer.checkTier,
      customer.lastCheckedAt,
      customer.source,
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = `\uFEFF${header.join(",")}\r\n${lines.join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fraudbd-customers-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
