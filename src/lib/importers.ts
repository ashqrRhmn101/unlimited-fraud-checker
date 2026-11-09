import { findPhones, stripPhones, toAsciiDigits } from "@/lib/phone";

/**
 * Customer list importer: Excel (.xlsx/.xls/.ods), CSV/TSV, PDF and pasted text.
 * Detects header rows in English and Bangla ("Name", "Mobile No", "নাম",
 * "মোবাইল", "ঠিকানা" …) and falls back to content-based column detection.
 */

export interface ImportedCustomer {
  phone: string;
  name: string | null;
  address: string | null;
  city: string | null;
  area: string | null;
  altPhones: string | null;
  note: string | null;
}

export interface ParseResult {
  customers: ImportedCustomer[];
  rowsScanned: number;
  invalid: number;
  duplicates: number;
  mapping: Record<string, string | null> | null;
  warnings: string[];
  fileType: "excel" | "csv" | "pdf" | "text";
}

export class ImportError extends Error {}

type Field = "phone" | "name" | "address" | "city" | "area" | "note";
type Columns = Partial<Record<Field, number>>;

export const MAX_IMPORT_CUSTOMERS = 20000;
export const SUPPORTED_EXTENSIONS = ["xlsx", "xls", "xlsm", "xlsb", "ods", "csv", "tsv", "pdf", "txt"];

/* ───────────────────────── text helpers ───────────────────────── */

function clean(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSerial(value: string): string {
  return value.replace(/^\s*(?:#|sl\.?|no\.?)?\s*\d{1,5}\s*[.)\-:|]\s*/i, "").replace(/^\s*\d{1,4}\s+(?=\D)/, "").trim();
}

function stripLabels(value: string): string {
  return value
    .replace(/\b(?:customer\s*name|name|phone|mobile|contact|address|cell)\s*(?:no\.?)?\s*[:：=-]\s*/gi, "")
    .replace(/(?:নাম|মোবাইল|ফোন|ঠিকানা|নম্বর)\s*[:：=-]\s*/g, "")
    .trim();
}

function isNoise(value: string): boolean {
  const text = toAsciiDigits(value).trim();
  if (!text) return true;
  if (/^[\d\s.,/:৳$+-]+$/.test(text)) return true;
  if (/^(?:tk|bdt|৳)?\s*[\d,.]+\s*(?:tk|taka|bdt|টাকা)?$/i.test(text)) return true;
  return /^(?:cod|paid|unpaid|pending|delivered|cancelled|returned|yes|no|n\/a|-)$/i.test(text);
}

function isNameLike(value: string): boolean {
  const text = value.trim();
  if (text.length < 2 || text.length > 60) return false;
  if (/\d/.test(toAsciiDigits(text))) return false;
  if (text.split(/\s+/).length > 6) return false;
  if (/(road|house|sector|block|lane|flat|thana|district|bazar|para|রোড|বাসা|থানা|জেলা|গ্রাম|বাজার)/i.test(text)) {
    return false;
  }
  return /^[\p{L}\p{M}][\p{L}\p{M}\s.'()-]*$/u.test(text);
}

function isAddressLike(value: string): boolean {
  const text = value.trim();
  if (text.length < 5) return false;
  if (!/[\p{L}]/u.test(text)) return false;
  return (
    /[,/#-]/.test(text) ||
    /\d/.test(toAsciiDigits(text)) ||
    /(road|house|sector|block|lane|flat|thana|upazila|district|bazar|para|village|city|dhaka|রোড|বাসা|থানা|জেলা|উপজেলা|গ্রাম|বাজার|ঢাকা)/i.test(
      text,
    ) ||
    text.split(/\s+/).length >= 3
  );
}

const CITY_WORDS: [string, string[]][] = [
  ["Dhaka", ["dhaka", "ঢাকা"]],
  ["Chattogram", ["chattogram", "chittagong", "ctg", "চট্টগ্রাম"]],
  ["Sylhet", ["sylhet", "সিলেট"]],
  ["Khulna", ["khulna", "খুলনা"]],
  ["Rajshahi", ["rajshahi", "রাজশাহী"]],
  ["Barishal", ["barishal", "barisal", "বরিশাল"]],
  ["Rangpur", ["rangpur", "রংপুর"]],
  ["Mymensingh", ["mymensingh", "ময়মনসিংহ", "ময়মনসিংহ"]],
  ["Cumilla", ["cumilla", "comilla", "কুমিল্লা"]],
  ["Narayanganj", ["narayanganj", "নারায়ণগঞ্জ", "নারায়ণগঞ্জ"]],
  ["Gazipur", ["gazipur", "গাজীপুর"]],
  ["Bogura", ["bogura", "bogra", "বগুড়া", "বগুড়া"]],
  ["Cox's Bazar", ["cox's bazar", "coxs bazar", "cox bazar", "কক্সবাজার"]],
  ["Jashore", ["jashore", "jessore", "যশোর"]],
  ["Noakhali", ["noakhali", "নোয়াখালী", "নোয়াখালী"]],
  ["Feni", ["feni", "ফেনী"]],
  ["Tangail", ["tangail", "টাঙ্গাইল"]],
  ["Dinajpur", ["dinajpur", "দিনাজপুর"]],
  ["Brahmanbaria", ["brahmanbaria", "ব্রাহ্মণবাড়িয়া"]],
  ["Savar", ["savar", "সাভার"]],
];

function hasWord(text: string, word: string): boolean {
  if (/^[a-z' ]+$/.test(word)) {
    return new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text);
  }
  return text.includes(word);
}

function detectCity(address: string): string | null {
  const text = address.toLowerCase();
  for (const [city, words] of CITY_WORDS) {
    if (words.some((word) => hasWord(text, word))) return city === "Savar" ? "Dhaka" : city;
  }
  return null;
}

/* ───────────────────────── header detection ───────────────────────── */

const KEYWORDS: { field: Field; words: string[] }[] = [
  { field: "phone", words: ["phone", "mobile", "contact", "cell", "tel", "whatsapp", "msisdn", "ফোন", "মোবাইল", "যোগাযোগ"] },
  { field: "note", words: ["product", "item", "note", "notes", "remark", "remarks", "comment", "পণ্য", "প্রোডাক্ট", "নোট", "মন্তব্য"] },
  { field: "address", words: ["address", "addr", "location", "shipping", "delivery", "ঠিকানা"] },
  { field: "city", words: ["city", "district", "zilla", "zila", "জেলা", "শহর"] },
  { field: "area", words: ["area", "thana", "upazila", "upozila", "zone", "থানা", "উপজেলা", "এলাকা"] },
  { field: "name", words: ["name", "customer", "client", "receiver", "recipient", "buyer", "নাম", "গ্রাহক", "কাস্টমার", "ক্রেতা"] },
];
const WEAK_PHONE = ["number", "no", "নম্বর", "নাম্বার"];
const EXCLUDE = ["order", "invoice", "serial", "sl", "id", "date", "amount", "price", "qty", "quantity", "total", "status", "cod", "tracking", "consignment", "অর্ডার", "তারিখ", "টাকা", "মূল্য", "ক্রমিক"];

function normalizeHeader(text: string): string {
  return toAsciiDigits(text)
    .toLowerCase()
    .replace(/[_\-./:()#*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyHeader(cell: string): Field | null {
  const text = normalizeHeader(cell);
  if (!text || text.length > 40) return null;
  const excluded = EXCLUDE.some((word) => hasWord(text, word));
  if (excluded) {
    if (["phone", "mobile", "ফোন", "মোবাইল"].some((word) => hasWord(text, word))) return "phone";
    if (["address", "ঠিকানা"].some((word) => hasWord(text, word))) return "address";
    if (["name", "নাম"].some((word) => hasWord(text, word)) && !hasWord(text, "product")) return "name";
    return null;
  }
  for (const { field, words } of KEYWORDS) {
    if (words.some((word) => hasWord(text, word))) return field;
  }
  if (WEAK_PHONE.some((word) => hasWord(text, word))) return "phone";
  return null;
}

function detectHeader(rows: string[][]): { index: number; columns: Columns; labels: Partial<Record<Field, string>> } | null {
  const limit = Math.min(rows.length, 20);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (findPhones(row.join(" | ")).length > 0) continue;
    const columns: Columns = {};
    const labels: Partial<Record<Field, string>> = {};
    row.forEach((cell, column) => {
      const field = classifyHeader(cell);
      if (field && columns[field] === undefined) {
        columns[field] = column;
        labels[field] = cell;
      }
    });
    const fields = Object.keys(columns);
    if (fields.length >= 2 && (columns.phone !== undefined || columns.name !== undefined)) {
      return { index, columns, labels };
    }
  }
  return null;
}

/* ───────────────────────── row parsing ───────────────────────── */

function finalize(
  phones: string[],
  fields: { name?: string; address?: string; city?: string; area?: string; note?: string },
): ImportedCustomer | null {
  if (phones.length === 0) return null;
  const name = stripSerial(stripLabels(clean(fields.name)));
  const address = stripLabels(clean(fields.address));
  const city = clean(fields.city) || (address ? detectCity(address) : null) || null;
  return {
    phone: phones[0],
    name: name && !isNoise(name) ? name : null,
    address: address && !isNoise(address) ? address : null,
    city,
    area: clean(fields.area) || null,
    altPhones: phones.slice(1).join(", ") || null,
    note: clean(fields.note) || null,
  };
}

function parseMappedRow(cells: string[], columns: Columns): ImportedCustomer | null {
  const get = (field: Field) => {
    const column = columns[field];
    return column === undefined ? "" : clean(cells[column]);
  };

  let phones = findPhones(get("phone")).map((match) => match.phone);
  if (phones.length === 0) {
    for (const cell of cells) {
      phones = findPhones(cell).map((match) => match.phone);
      if (phones.length > 0) break;
    }
  }
  if (phones.length === 0) return null;

  let name = clean(stripPhones(get("name")));
  let address = clean(stripPhones(get("address")));

  if (!name || !address) {
    const used = new Set(Object.values(columns));
    const leftovers = cells
      .map((cell, column) => (used.has(column) ? "" : clean(stripPhones(cell))))
      .filter((cell) => cell && !isNoise(cell));
    if (!name) {
      const index = leftovers.findIndex((cell) => isNameLike(stripSerial(cell)));
      if (index >= 0) name = leftovers.splice(index, 1)[0];
    }
    if (!address) {
      const candidate = leftovers.filter(isAddressLike).sort((a, b) => b.length - a.length)[0];
      if (candidate) address = candidate;
    }
  }

  return finalize(phones, { name, address, city: get("city"), area: get("area"), note: get("note") });
}

function parseLooseLine(line: string): ImportedCustomer | null {
  const text = clean(line);
  const matches = findPhones(text);
  if (matches.length === 0) return null;
  const phones = matches.map((match) => match.phone);
  const first = matches[0];
  const last = matches[matches.length - 1];
  const before = stripLabels(stripSerial(clean(text.slice(0, first.start)))).replace(/[,|;:-]+$/, "").trim();
  const after = stripLabels(clean(stripPhones(text.slice(last.end)))).replace(/^[,|;:-]+/, "").trim();

  let name = "";
  let address = "";
  if (before && isNameLike(before)) {
    name = before;
    address = after;
  } else if (before) {
    const parts = before.split(/[,|;]/).map(clean).filter(Boolean);
    if (parts.length > 1 && isNameLike(parts[0])) {
      name = parts[0];
      address = [parts.slice(1).join(", "), after].filter(Boolean).join(", ");
    } else {
      address = [before, after].filter(Boolean).join(", ");
    }
  } else if (after) {
    const parts = after.split(/[,|;]/).map(clean).filter(Boolean);
    if (parts.length > 1 && isNameLike(parts[0])) {
      name = parts[0];
      address = parts.slice(1).join(", ");
    } else if (isNameLike(after)) {
      name = after;
    } else {
      address = after;
    }
  }

  return finalize(phones, { name, address });
}

function bestColumn(rows: string[][], width: number, exclude: Set<number>, test: (value: string) => boolean): number | null {
  let best: number | null = null;
  let bestScore = 0;
  for (let column = 0; column < width; column += 1) {
    if (exclude.has(column)) continue;
    let score = 0;
    let filled = 0;
    for (const row of rows) {
      const value = clean(row[column]);
      if (!value) continue;
      filled += 1;
      if (test(value)) score += 1;
    }
    if (filled > 0 && score > bestScore && score >= Math.max(1, rows.length * 0.3)) {
      best = column;
      bestScore = score;
    }
  }
  return best;
}

function extractCustomers(rawRows: string[][]): {
  customers: ImportedCustomer[];
  invalid: number;
  scanned: number;
  mapping: Record<string, string | null> | null;
} {
  const rows = rawRows.map((row) => row.map((cell) => clean(cell))).filter((row) => row.some(Boolean));
  if (rows.length === 0) return { customers: [], invalid: 0, scanned: 0, mapping: null };

  const header = detectHeader(rows);
  const dataRows = header ? rows.slice(header.index + 1) : rows;
  const columns: Columns = header ? { ...header.columns } : {};
  const multiColumn = dataRows.filter((row) => row.filter(Boolean).length >= 2).length >= dataRows.length * 0.5;
  const width = dataRows.reduce((max, row) => Math.max(max, row.length), 0);

  if (multiColumn && width > 0) {
    const phoneCounts = Array.from({ length: width }, (_, column) =>
      dataRows.reduce((acc, row) => acc + (findPhones(row[column] ?? "").length > 0 ? 1 : 0), 0),
    );
    const bestPhone = phoneCounts.indexOf(Math.max(...phoneCounts));
    if (columns.phone === undefined || phoneCounts[columns.phone] < phoneCounts[bestPhone] * 0.5) {
      columns.phone = bestPhone;
    }
    const used = new Set(Object.values(columns).filter((value): value is number => value !== undefined));
    if (columns.name === undefined) {
      const column = bestColumn(dataRows, width, used, (value) => isNameLike(stripSerial(value)));
      if (column !== null) {
        columns.name = column;
        used.add(column);
      }
    }
    if (columns.address === undefined) {
      const column = bestColumn(dataRows, width, used, (value) => isAddressLike(value) && findPhones(value).length === 0);
      if (column !== null) columns.address = column;
    }
  }

  const customers: ImportedCustomer[] = [];
  let invalid = 0;
  for (const row of dataRows) {
    const filled = row.filter(Boolean);
    const parsed =
      multiColumn && filled.length >= 2 ? parseMappedRow(row, columns) : parseLooseLine(filled.join(" "));
    if (parsed) customers.push(parsed);
    else invalid += 1;
  }

  const label = (field: Field) => {
    const column = columns[field];
    if (column === undefined) return null;
    return header?.labels[field] ?? `কলাম ${column + 1} (auto)`;
  };

  return {
    customers,
    invalid,
    scanned: dataRows.length,
    mapping: multiColumn
      ? { phone: label("phone"), name: label("name"), address: label("address"), city: label("city"), area: label("area") }
      : { phone: "লাইন থেকে খুঁজে নেওয়া", name: "auto", address: "auto", city: null, area: null },
  };
}

function dedupe(list: ImportedCustomer[]): { customers: ImportedCustomer[]; duplicates: number } {
  const map = new Map<string, ImportedCustomer>();
  let duplicates = 0;
  for (const item of list) {
    const existing = map.get(item.phone);
    if (!existing) {
      map.set(item.phone, { ...item });
      continue;
    }
    duplicates += 1;
    existing.name = existing.name ?? item.name;
    existing.address = existing.address ?? item.address;
    existing.city = existing.city ?? item.city;
    existing.area = existing.area ?? item.area;
    existing.note = existing.note ?? item.note;
    existing.altPhones = existing.altPhones ?? item.altPhones;
  }
  return { customers: [...map.values()], duplicates };
}

/* ───────────────────────── labeled text (WhatsApp/Messenger orders) ───────────────────────── */

const LABELS: Record<Field, RegExp> = {
  name: /^(?:customer\s*name|name|receiver(?:\s*name)?|নাম|গ্রাহকের নাম|কাস্টমারের নাম)\s*[:：=\-–]\s*(.*)$/i,
  phone: /^(?:phone|mobile|contact|number|cell|whatsapp|ফোন|মোবাইল|নম্বর|নাম্বার)(?:\s*(?:no\.?|number|নম্বর|নাম্বার))?\s*[:：=\-–]\s*(.*)$/i,
  address: /^(?:address|delivery\s*address|shipping\s*address|location|ঠিকানা)\s*[:：=\-–]\s*(.*)$/i,
  city: /^(?:city|district|জেলা|শহর)\s*[:：=\-–]\s*(.*)$/i,
  area: /^(?:area|thana|upazila|থানা|উপজেলা|এলাকা)\s*[:：=\-–]\s*(.*)$/i,
  note: /^(?:note|product|item|নোট|পণ্য|প্রোডাক্ট)\s*[:：=\-–]\s*(.*)$/i,
};

function parseLabeledBlocks(lines: string[]): ImportedCustomer[] | null {
  const labeled = lines.filter((line) => Object.values(LABELS).some((re) => re.test(line.trim()))).length;
  if (labeled < 2) return null;

  const blocks: { fields: Partial<Record<Field, string>>; extra: string[] }[] = [];
  let current: { fields: Partial<Record<Field, string>>; extra: string[] } = { fields: {}, extra: [] };
  const flush = () => {
    if (Object.keys(current.fields).length > 0 || current.extra.length > 0) blocks.push(current);
    current = { fields: {}, extra: [] };
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    let matched = false;
    for (const field of Object.keys(LABELS) as Field[]) {
      const match = line.match(LABELS[field]);
      if (match) {
        if (current.fields[field] && (field === "name" || field === "phone")) flush();
        current.fields[field] = match[1].trim();
        matched = true;
        break;
      }
    }
    if (!matched) current.extra.push(line);
  }
  flush();

  const customers: ImportedCustomer[] = [];
  for (const block of blocks) {
    if (Object.keys(block.fields).length === 0) {
      // Unlabeled lines inside a labeled paste (e.g. "Sumon 01999-887766 Kazir Dewri")
      for (const line of block.extra) {
        const parsed = parseLooseLine(line);
        if (parsed) customers.push(parsed);
      }
      continue;
    }
    const phoneSource = block.fields.phone ?? block.extra.join(" ");
    let phones = findPhones(phoneSource).map((match) => match.phone);
    if (phones.length === 0) phones = findPhones(Object.values(block.fields).join(" ")).map((match) => match.phone);
    const extraText = block.extra.filter((line) => findPhones(line).length === 0).join(", ");
    const parsed = finalize(phones, {
      name: block.fields.name,
      address: block.fields.address ?? extraText,
      city: block.fields.city,
      area: block.fields.area,
      note: block.fields.note,
    });
    if (parsed) customers.push(parsed);
  }
  return customers;
}

/* ───────────────────────── file readers ───────────────────────── */

export function decodeText(data: Uint8Array): string {
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data.subarray(2));
  const text = new TextDecoder("utf-8").decode(data);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? value.toFixed(0) : String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value);
}

async function rowsFromSpreadsheet(data: Uint8Array, ext: string): Promise<string[][][]> {
  const XLSX = await import("@e965/xlsx");
  const workbook =
    ext === "csv" || ext === "tsv"
      ? XLSX.read(decodeText(data), { type: "string", raw: true })
      : XLSX.read(data, { type: "array", cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
    return rows.map((row) => (Array.isArray(row) ? row.map(cellToString) : []));
  });
}

interface PdfItem {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

async function rowsFromPdf(data: Uint8Array): Promise<string[][]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const rows: string[][] = [];
  const pages = Math.min(pdf.numPages, 300);

  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items as unknown[]) {
      const item = raw as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown };
      if (typeof item.str !== "string" || !Array.isArray(item.transform)) continue;
      if (!item.str.trim()) continue;
      const transform = item.transform as number[];
      const h = Number(item.height) || Math.abs(transform[3]) || 10;
      items.push({
        text: item.str,
        x: transform[4],
        y: transform[5],
        w: Number(item.width) || item.str.length * h * 0.5,
        h,
      });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PdfItem[][] = [];
    for (const item of items) {
      const line = lines[lines.length - 1];
      if (line && Math.abs(line[0].y - item.y) <= Math.max(2, item.h * 0.45)) line.push(item);
      else lines.push([item]);
    }

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let current = "";
      let previousEnd: number | null = null;
      for (const item of line) {
        const gap = previousEnd === null ? 0 : item.x - previousEnd;
        if (previousEnd !== null && gap > Math.max(9, item.h * 1.2)) {
          if (current.trim()) cells.push(current.trim());
          current = item.text;
        } else {
          const needsSpace = previousEnd !== null && gap > item.h * 0.12 && !current.endsWith(" ");
          current += (needsSpace ? " " : "") + item.text;
        }
        previousEnd = item.x + item.w;
      }
      if (current.trim()) cells.push(current.trim());
      if (cells.length > 0) rows.push(cells);
    }
  }

  try {
    await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
  } catch {
    // ignore cleanup errors
  }
  return rows;
}

/* ───────────────────────── public API ───────────────────────── */

export function parseText(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const warnings: string[] = [];

  const labeled = parseLabeledBlocks(lines);
  let customers: ImportedCustomer[];
  let invalid = 0;
  let scanned = 0;
  let mapping: Record<string, string | null> | null = null;

  if (labeled) {
    customers = labeled;
    scanned = lines.filter((line) => line.trim()).length;
    mapping = { phone: "Phone/মোবাইল লেবেল", name: "Name/নাম লেবেল", address: "Address/ঠিকানা লেবেল", city: null, area: null };
  } else {
    const rows = lines.filter((line) => line.trim()).map((line) => (line.includes("\t") ? line.split("\t") : [line]));
    const result = extractCustomers(rows);
    customers = result.customers;
    invalid = result.invalid;
    scanned = result.scanned;
    mapping = result.mapping;
  }

  const { customers: unique, duplicates } = dedupe(customers);
  if (unique.length > MAX_IMPORT_CUSTOMERS) {
    warnings.push(`একবারে সর্বোচ্চ ${MAX_IMPORT_CUSTOMERS} জন ইমপোর্ট করা যায় — বাকিগুলো বাদ দেওয়া হয়েছে।`);
    unique.length = MAX_IMPORT_CUSTOMERS;
  }
  return { customers: unique, rowsScanned: scanned, invalid, duplicates, mapping, warnings, fileType: "text" };
}

export async function parseUpload(fileName: string, data: Uint8Array): Promise<ParseResult> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ImportError("এই ফাইল টাইপ সাপোর্টেড নয়। Excel (.xlsx / .xls), CSV, PDF অথবা TXT ফাইল দিন।");
  }
  if (ext === "txt") return parseText(decodeText(data));

  const warnings: string[] = [];
  const all: ImportedCustomer[] = [];
  let rowsScanned = 0;
  let invalid = 0;
  let mapping: Record<string, string | null> | null = null;
  let fileType: ParseResult["fileType"] = "excel";

  if (ext === "pdf") {
    fileType = "pdf";
    let rows: string[][];
    try {
      rows = await rowsFromPdf(data);
    } catch (error) {
      console.error("[import] pdf parse failed", error);
      throw new ImportError("PDF ফাইলটি পড়া যায়নি। ফাইলটি পাসওয়ার্ড-সুরক্ষিত বা নষ্ট কিনা দেখুন।");
    }
    const result = extractCustomers(rows);
    all.push(...result.customers);
    rowsScanned = result.scanned;
    invalid = result.invalid;
    mapping = result.mapping;
    if (result.customers.length === 0) {
      warnings.push("PDF-এ কোনো মোবাইল নম্বর পাওয়া যায়নি। স্ক্যান করা (ছবি) PDF-এ টেক্সট থাকে না — Excel বা CSV ব্যবহার করুন।");
    }
  } else {
    fileType = ext === "csv" || ext === "tsv" ? "csv" : "excel";
    let sheets: string[][][];
    try {
      sheets = await rowsFromSpreadsheet(data, ext);
    } catch (error) {
      console.error("[import] spreadsheet parse failed", error);
      throw new ImportError("Excel/CSV ফাইলটি পড়া যায়নি। ফাইলটি সঠিক ফরম্যাটে আছে কিনা দেখুন।");
    }
    for (const rows of sheets) {
      const result = extractCustomers(rows);
      all.push(...result.customers);
      rowsScanned += result.scanned;
      invalid += result.invalid;
      if (!mapping && result.customers.length > 0) mapping = result.mapping;
    }
  }

  const { customers, duplicates } = dedupe(all);
  if (customers.length > MAX_IMPORT_CUSTOMERS) {
    warnings.push(`একবারে সর্বোচ্চ ${MAX_IMPORT_CUSTOMERS} জন ইমপোর্ট করা যায় — বাকিগুলো বাদ দেওয়া হয়েছে।`);
    customers.length = MAX_IMPORT_CUSTOMERS;
  }
  return { customers, rowsScanned, invalid, duplicates, mapping, warnings, fileType };
}
