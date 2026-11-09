import type { CourierReport } from "@/lib/courier";

export interface CustomerDTO {
  id: number;
  phone: string;
  name: string | null;
  address: string | null;
  city: string | null;
  area: string | null;
  altPhones: string | null;
  note: string | null;
  source: string;
  uploadId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastCheckedAt: string | null;
  checkTotal: number | null;
  checkDelivered: number | null;
  checkCancelled: number | null;
  checkRate: number | null;
  checkLevel: string | null;
  checkTier: string | null;
}

export interface CustomerCounts {
  all: number;
  unchecked: number;
  checked: number;
  good: number;
  risky: number;
  noRecord: number;
  demo: number;
}

export interface UsageDTO {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  plan: string;
}

export type CustomerFilter = "all" | "unchecked" | "checked" | "good" | "risky" | "new";
export type CustomerSort = "new" | "old" | "name" | "risk";

export interface CustomerListResponse {
  ok: true;
  items: CustomerDTO[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  counts: CustomerCounts;
  usage: UsageDTO;
}

export type CheckSuccess = {
  ok: true;
  source: "live" | "cache";
  phone: string;
  report: CourierReport;
  checkedAt: string;
  usage: UsageDTO;
  warning: string | null;
  durationMs: number | null;
};

export type CheckFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  phone: string | null;
  usage: UsageDTO | null;
  report: CourierReport | null;
  checkedAt: string | null;
};

export type CheckApiResult = CheckSuccess | CheckFailure;

export interface ImportPreviewRow {
  phone: string;
  name: string | null;
  address: string | null;
  city: string | null;
}

export interface UploadSummary {
  fileName: string;
  fileType: string;
  rowsScanned: number;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  invalid: number;
  duplicates: number;
  mapping: Record<string, string | null> | null;
  warnings: string[];
}
