/* Types, sample documents, schemas and the scripted extraction used by the preview. */

/** A run of document text. A string is plain text; an object marks a source span the model can cite by id. */
export type Segment = string | { span: string; text: string };
export type Rich = string | Segment[];

/** A printed wordmark built from text, with an optional simple symbol before it. Colors are print colors, the same in both themes. */
export interface DocLogo { name: string; detail?: string; color?: string; symbol?: "petals" | "peak" | "none" }

export type DocBlock =
  /** Top of a page: the sender's wordmark on the left and the document title on the right. */
  | { type: "masthead"; logo?: DocLogo; title?: string }
  /** The header of an email message: subject, sender with an avatar, recipient and date. */
  | { type: "email"; subject: Rich; from: { name: Rich; address: string }; to: string; date: string }
  | { type: "heading"; text: Rich }
  | { type: "paragraph"; text: Rich; tone?: "muted" }
  /** An address or any short stack of lines under a small label. */
  | { type: "lines"; label?: string; lines: Rich[] }
  | { type: "pairs"; rows: [label: string, value: Rich][] }
  /** A strip of label and value cells between hairlines, such as invoice number, date and terms. */
  | { type: "meta"; items: [label: string, value: Rich][] }
  | { type: "columns"; columns: DocBlock[][] }
  /** A table with hairline rules. `details` adds a muted second line under each row's first cell. */
  | { type: "table"; columns: { label: string; align?: "end" }[]; rows: Rich[][]; details?: (string | undefined)[] }
  /** Totals aligned to the right. The strong row is the grand total and sits on a double rule. */
  | { type: "totals"; rows: { label: Rich; value: Rich; strong?: boolean }[] }
  | { type: "rule" }
  /** Small print pinned to the bottom of the page. */
  | { type: "footer"; lines: Rich[] };

export interface SourceDocument {
  id: string;
  /** File name shown in the viewer toolbar, such as "larkspur-invoice-0418.pdf". */
  name: string;
  /** Short label for the document switcher. */
  label: string;
  /** "pdf" draws an A4 sheet with a page count; "email" draws a message view. Inferred from the name when left out. */
  kind?: "pdf" | "email";
  /** Shown after the name in the switcher, such as "PDF, 1 page". */
  meta?: string;
  blocks: DocBlock[];
}

export type FieldType = "string" | "date" | "money" | "currency" | "iban" | "integer" | "number";
export interface SchemaField { key: string; label: string; type: FieldType; description?: string; group?: string }
export interface SchemaTable { key: string; label: string; type: "table"; description?: string; group?: string; columns: Omit<SchemaField, "group">[] }
export type SchemaEntry = SchemaField | SchemaTable;
/** A named set of fields. Each group takes one of the four series colors, in order, for its spans, rows and connector. */
export interface SchemaGroup { key: string; label: string }
export interface ExtractSchema { name: string; title: string; description?: string; groups?: SchemaGroup[]; fields: SchemaEntry[] }

/** One value the model found. `path` is the field key, or `table.row.column` for a table cell, such as "lineItems.0.amount". */
export interface ExtractValue { path: string; value: string; source?: string; confidence: number; note?: string }
export type ExtractEvent =
  | ({ type: "value" } & ExtractValue)
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string };
export type ExtractFn = (document: SourceDocument, schema: ExtractSchema, options: { signal: AbortSignal }) => AsyncIterable<ExtractEvent> | Promise<ExtractEvent[]>;

export interface ExtractModel {
  name: string;
  /** API id, used in the schema tab and the failure message. */
  id: string;
  /** US dollars per million input and output tokens. */
  inputPrice: number;
  outputPrice: number;
}

export const haiku: ExtractModel = { name: "Claude Haiku 5.5", id: "claude-haiku-5-5", inputPrice: 0.1, outputPrice: 0.5 };

export const kindOf = (document: SourceDocument) => document.kind ?? (/\.(eml|msg)$/i.test(document.name) ? "email" : "pdf");

/* ---------------------------------------------------------------------------------------------------------------
 * Invoice
 * ------------------------------------------------------------------------------------------------------------- */

const li = (row: number, col: string, text: string): Segment => ({ span: `li-${row}-${col}`, text });

export const sampleInvoice: SourceDocument = {
  id: "invoice",
  name: "larkspur-invoice-0418.pdf",
  label: "Invoice",
  kind: "pdf",
  meta: "PDF, 1 page",
  blocks: [
    { type: "masthead", logo: { name: "larkspur", detail: "studio", color: "#3d4fc4", symbol: "petals" }, title: "Invoice" },
    { type: "columns", columns: [
      [{ type: "lines", label: "From", lines: [[{ span: "vendor", text: "Larkspur Studio GmbH" }], "Langstrasse 112", "8004 Zürich, Switzerland", "VAT CHE-412.773.905 MWST"] }],
      [{ type: "lines", label: "Bill to", lines: ["Fjord Analytics AG", "Attn. Lena Brunner", "Seefeldstrasse 45", "8008 Zürich, Switzerland"] }],
    ] },
    { type: "meta", items: [
      ["Invoice no.", [{ span: "number", text: "INV-2026-0418" }]],
      ["Issue date", [{ span: "issue", text: "14 October 2026" }]],
      ["Payment terms", [{ span: "terms", text: "30 days net" }]],
      ["Customer no.", "FJ-20931"],
    ] },
    { type: "table", columns: [{ label: "Description" }, { label: "Qty", align: "end" }, { label: "Unit price", align: "end" }, { label: "Amount", align: "end" }],
      details: ["Discovery, flows and high fidelity screens", "Moderated remote sessions, 45 minutes each", "Tokens, components and usage notes", "Staging environment for the test rounds"],
      rows: [
        [[li(0, "d", "Product design sprint, week 41")], [li(0, "q", "5"), " days"], [li(0, "u", "1,400.00")], [li(0, "a", "7,000.00")]],
        [[li(1, "d", "Usability testing sessions")], [li(1, "q", "6")], [li(1, "u", "260.00")], [li(1, "a", "1,560.00")]],
        [[li(2, "d", "Design system audit")], [li(2, "q", "1")], [li(2, "u", "2,400.00")], [li(2, "a", "2,400.00")]],
        [[li(3, "d", "Prototype hosting, October")], [li(3, "q", "1")], [li(3, "u", "45.00")], [li(3, "a", "45.00")]],
      ] },
    { type: "totals", rows: [
      { label: "Subtotal", value: [{ span: "subtotal", text: "11,005.00" }] },
      { label: "VAT 8.1%", value: [{ span: "vat", text: "891.41" }] },
      { label: ["Total due ", { span: "currency", text: "CHF" }], value: [{ span: "total", text: "11,896.41" }], strong: true },
    ] },
    { type: "heading", text: "Payment details" },
    { type: "pairs", rows: [["Account holder", "Larkspur Studio GmbH"], ["IBAN", [{ span: "iban", text: "CH56 0483 5012 3456 7800 9" }]], ["Reference", "INV-2026-0418"]] },
    { type: "paragraph", tone: "muted", text: "Our bank details changed on 1 October 2026. Please stop using CH69 0070 0110 0012 3456 7 for new payments." },
    { type: "footer", lines: ["Larkspur Studio GmbH · Langstrasse 112 · 8004 Zürich", "billing@larkspur.example · larkspur.example"] },
  ],
};

export const invoiceSchema: ExtractSchema = {
  name: "invoice",
  title: "Invoice",
  description: "A supplier invoice with its line items, totals and payment details.",
  groups: [
    { key: "details", label: "Invoice" },
    { key: "items", label: "Line items" },
    { key: "totals", label: "Totals" },
    { key: "payment", label: "Payment" },
  ],
  fields: [
    { key: "vendor", label: "Vendor", type: "string", group: "details", description: "Legal name of the company that issued the invoice." },
    { key: "invoiceNumber", label: "Invoice no.", type: "string", group: "details" },
    { key: "issueDate", label: "Issue date", type: "date", group: "details" },
    { key: "dueDate", label: "Due date", type: "date", group: "details", description: "Infer from the payment terms when no date is printed." },
    { key: "lineItems", label: "Line items", type: "table", group: "items", columns: [
      { key: "description", label: "Description", type: "string" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "unitPrice", label: "Unit price", type: "money" },
      { key: "amount", label: "Amount", type: "money" },
    ] },
    { key: "currency", label: "Currency", type: "currency", group: "totals", description: "ISO 4217 code." },
    { key: "subtotal", label: "Subtotal", type: "money", group: "totals" },
    { key: "vat", label: "VAT", type: "money", group: "totals" },
    { key: "total", label: "Total", type: "money", group: "totals" },
    { key: "iban", label: "IBAN", type: "iban", group: "payment", description: "The account to pay into now." },
  ],
};

/* ---------------------------------------------------------------------------------------------------------------
 * Shipping confirmation email
 * ------------------------------------------------------------------------------------------------------------- */

const it = (row: number, col: string, text: string): Segment => ({ span: `it-${row}-${col}`, text });

export const sampleEmail: SourceDocument = {
  id: "shipping",
  name: "Your order HD-58213 is on its way.eml",
  label: "Shipping email",
  kind: "email",
  meta: "Email",
  blocks: [
    { type: "email", subject: "Your order HD-58213 is on its way", from: { name: [{ span: "merchant", text: "Halden Outdoor" }], address: "orders@haldenoutdoor.example" }, to: "Maya Lindqvist", date: "Fri, 16 Oct 2026, 09:42" },
    { type: "masthead", logo: { name: "halden", detail: "outdoor", color: "#1f6a50", symbol: "peak" } },
    { type: "paragraph", text: "Hi Maya," },
    { type: "paragraph", text: ["Good news: your order ", { span: "order", text: "HD-58213" }, " ", { span: "shipped", text: "shipped today" }, " from our warehouse in Rotterdam. It is travelling with ", { span: "carrier", text: "DHL Express" }, " and should arrive on ", { span: "eta", text: "Tuesday, 20 October" }, "."] },
    { type: "meta", items: [["Tracking number", [{ span: "tracking", text: "JVGL 0624 1180 3317" }]], ["Shipping to", [{ span: "recipient", text: "Maya Lindqvist" }]]] },
    { type: "lines", lines: [[{ span: "address", text: "Kungsgatan 18, 111 43 Stockholm, Sweden" }]] },
    { type: "heading", text: "Items in this shipment" },
    { type: "table", columns: [{ label: "Item" }, { label: "Qty", align: "end" }, { label: "Price", align: "end" }], rows: [
      [[it(0, "d", "Trail shell jacket, slate, M")], [it(0, "q", "1")], ["€", it(0, "a", "189.00")]],
      [[it(1, "d", "Merino base layer, M")], [it(1, "q", "2")], ["€", it(1, "a", "118.00")]],
      [[it(2, "d", "Insulated bottle, 750 ml")], [it(2, "q", "1")], ["€", it(2, "a", "34.00")]],
    ] },
    { type: "totals", rows: [
      { label: "Shipping", value: [{ span: "shipping", text: "Free" }] },
      { label: "Total paid", value: [{ span: "currency", text: "€" }, { span: "total", text: "341.00" }], strong: true },
    ] },
    { type: "paragraph", tone: "muted", text: "Your wool beanie ships separately once it is back in stock on 27 October." },
    { type: "paragraph", text: "Thanks for shopping with us,\nThe Halden Outdoor team" },
    { type: "footer", lines: ["Halden Outdoor · Westerkade 4 · 3016 CM Rotterdam", "You get this email because you ordered from haldenoutdoor.example"] },
  ],
};

export const shipmentSchema: ExtractSchema = {
  name: "shipment",
  title: "Shipment",
  description: "A shipping confirmation with the carrier, dates, address and the items in the parcel.",
  groups: [
    { key: "order", label: "Order" },
    { key: "delivery", label: "Delivery" },
    { key: "items", label: "Items" },
    { key: "totals", label: "Totals" },
  ],
  fields: [
    { key: "merchant", label: "Merchant", type: "string", group: "order" },
    { key: "orderNumber", label: "Order no.", type: "string", group: "order" },
    { key: "carrier", label: "Carrier", type: "string", group: "delivery" },
    { key: "trackingNumber", label: "Tracking no.", type: "string", group: "delivery" },
    { key: "shipDate", label: "Ship date", type: "date", group: "delivery", description: "Resolve relative dates against the email date." },
    { key: "estimatedDelivery", label: "Arrives", type: "date", group: "delivery" },
    { key: "recipient", label: "Recipient", type: "string", group: "delivery" },
    { key: "shipTo", label: "Ship to", type: "string", group: "delivery" },
    { key: "items", label: "Items", type: "table", group: "items", columns: [
      { key: "description", label: "Item", type: "string" },
      { key: "quantity", label: "Qty", type: "integer" },
      { key: "amount", label: "Amount", type: "money" },
    ] },
    { key: "currency", label: "Currency", type: "currency", group: "totals", description: "ISO 4217 code." },
    { key: "shippingCost", label: "Shipping", type: "money", group: "totals" },
    { key: "total", label: "Total", type: "money", group: "totals" },
  ],
};

export interface ExtractSample { document: SourceDocument; schema: ExtractSchema }
export const sampleDocuments: ExtractSample[] = [
  { document: sampleInvoice, schema: invoiceSchema },
  { document: sampleEmail, schema: shipmentSchema },
];

/** The series color (1 to 4) for each top level field: its group's place in `groups`, or its own place when there are no groups. */
export function fieldTones(schema: ExtractSchema): Record<string, number> {
  const groups = schema.groups ?? [];
  return Object.fromEntries(schema.fields.map((field, index) => {
    const group = field.group ? groups.findIndex(item => item.key === field.group) : -1;
    return [field.key, ((group >= 0 ? group : index) % 4) + 1];
  }));
}

/* ---------------------------------------------------------------------------------------------------------------
 * Scripted runs for the preview
 * ------------------------------------------------------------------------------------------------------------- */

type Script = { inputTokens: number; values: ExtractValue[]; failAfter?: number };

const cells = (table: string, prefix: string, rows: string[][], columns: string[], spanCols: string[], confidence: number[][]): ExtractValue[] =>
  rows.flatMap((row, r) => row.map((value, c) => ({ path: `${table}.${r}.${columns[c]}`, value, source: `${prefix}-${r}-${spanCols[c]}`, confidence: confidence[r]?.[c] ?? .97 })));

export const scripts: Record<string, Script> = {
  invoice: {
    inputTokens: 1920,
    values: [
      { path: "vendor", value: "Larkspur Studio GmbH", source: "vendor", confidence: .99 },
      { path: "invoiceNumber", value: "INV-2026-0418", source: "number", confidence: .99 },
      { path: "issueDate", value: "2026-10-14", source: "issue", confidence: .98 },
      { path: "dueDate", value: "2026-11-13", source: "terms", confidence: .64, note: "Not printed. Worked out as the issue date plus 30 days net." },
      ...cells("lineItems", "li", [
        ["Product design sprint, week 41", "5", "1,400.00", "7,000.00"],
        ["Usability testing sessions", "6", "260.00", "1,560.00"],
        ["Design system audit", "1", "2,400.00", "2,400.00"],
        ["Prototype hosting, October", "1", "45.00", "45.00"],
      ], ["description", "quantity", "unitPrice", "amount"], ["d", "q", "u", "a"], [[.98, .93, .99, .99], [.99, .98, .99, .99], [.99, .98, .99, .99], [.97, .98, .99, .99]]),
      { path: "currency", value: "CHF", source: "currency", confidence: .97 },
      { path: "subtotal", value: "11,005.00", source: "subtotal", confidence: .99 },
      { path: "vat", value: "891.41", source: "vat", confidence: .97 },
      { path: "total", value: "11,896.41", source: "total", confidence: .99 },
      { path: "iban", value: "CH56 0483 5012 3456 7800 9", source: "iban", confidence: .72, note: "Two account numbers on the page. Took the current one, the other is marked as closed." },
    ],
  },
  shipping: {
    inputTokens: 1340,
    failAfter: 4,
    values: [
      { path: "merchant", value: "Halden Outdoor", source: "merchant", confidence: .98 },
      { path: "orderNumber", value: "HD-58213", source: "order", confidence: .99 },
      { path: "carrier", value: "DHL Express", source: "carrier", confidence: .99 },
      { path: "trackingNumber", value: "JVGL 0624 1180 3317", source: "tracking", confidence: .97 },
      { path: "shipDate", value: "2026-10-16", source: "shipped", confidence: .74, note: "The email says shipped today. Read today as the date the email was sent." },
      { path: "estimatedDelivery", value: "2026-10-20", source: "eta", confidence: .79, note: "No year in the text. Took 2026 from the email date." },
      { path: "recipient", value: "Maya Lindqvist", source: "recipient", confidence: .99 },
      { path: "shipTo", value: "Kungsgatan 18, 111 43 Stockholm, Sweden", source: "address", confidence: .97 },
      ...cells("items", "it", [
        ["Trail shell jacket, slate, M", "1", "189.00"],
        ["Merino base layer, M", "2", "118.00"],
        ["Insulated bottle, 750 ml", "1", "34.00"],
      ], ["description", "quantity", "amount"], ["d", "q", "a"], [[.98, .99, .99], [.98, .97, .96], [.99, .99, .99]]),
      { path: "currency", value: "EUR", source: "currency", confidence: .95 },
      { path: "shippingCost", value: "0.00", source: "shipping", confidence: .93 },
      { path: "total", value: "341.00", source: "total", confidence: .99 },
    ],
  },
};

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
  const id = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { window.clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/** Rough output tokens for one value: the key, quotes and the value itself. */
const tokensFor = (value: ExtractValue) => 6 + Math.ceil(value.value.length / 3.2);

/**
 * The preview's stand-in for a real model call. It streams the scripted values for the sample documents in the order a model writes
 * them, with usage updates, and fails the first run of the shipping email so the retry path can be tried.
 */
export function createDemoExtract(): ExtractFn {
  const attempts = new Map<string, number>();
  return async function* demoExtract(document, _schema, { signal }) {
    const script = scripts[document.id];
    if (!script) { yield { type: "error", message: "The preview only has scripted runs for its two sample documents." }; return; }
    const attempt = (attempts.get(document.id) ?? 0) + 1;
    attempts.set(document.id, attempt);
    yield { type: "usage", inputTokens: script.inputTokens, outputTokens: 0 };
    await wait(760, signal);
    let output = 4;
    for (const [index, value] of script.values.entries()) {
      if (script.failAfter !== undefined && attempt === 1 && index === script.failAfter) {
        await wait(900, signal);
        yield { type: "error", message: "overloaded_error (529): the model is busy right now." };
        return;
      }
      const cell = value.path.split(".").length > 1;
      await wait(cell ? 46 + (index % 3) * 14 : 120 + (index % 4) * 26, signal);
      output += tokensFor(value);
      yield { type: "value", ...value };
      yield { type: "usage", inputTokens: script.inputTokens, outputTokens: output };
    }
  };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------------------- */

export const richText = (rich: Rich) => typeof rich === "string" ? rich : rich.map(part => typeof part === "string" ? part : part.text).join("");

/** The document as plain text, the way you would send it to a model. */
export function documentToText(document: SourceDocument): string {
  const block = (item: DocBlock): string => {
    switch (item.type) {
      case "masthead": return [item.logo ? [item.logo.name, item.logo.detail].filter(Boolean).join(" ") : "", item.title ?? ""].filter(Boolean).join("\n");
      case "email": return [`From: ${richText(item.from.name)} <${item.from.address}>`, `To: ${item.to}`, `Date: ${item.date}`, `Subject: ${richText(item.subject)}`].join("\n");
      case "heading": case "paragraph": return richText(item.text);
      case "lines": return [item.label, ...item.lines.map(richText)].filter(Boolean).join("\n");
      case "pairs": case "meta": return (item.type === "pairs" ? item.rows : item.items).map(([label, value]) => `${label}: ${richText(value)}`).join("\n");
      case "columns": return item.columns.map(column => column.map(block).join("\n\n")).join("\n\n");
      case "table": return [item.columns.map(column => column.label).join(" | "), ...item.rows.map((row, index) => row.map(richText).join(" | ") + (item.details?.[index] ? ` (${item.details[index]})` : ""))].join("\n");
      case "totals": return item.rows.map(row => `${richText(row.label)}: ${richText(row.value)}`).join("\n");
      case "footer": return item.lines.map(richText).join("\n");
      case "rule": return "";
    }
  };
  return document.blocks.map(block).filter(Boolean).join("\n\n");
}

const jsonType: Record<FieldType, Record<string, unknown>> = {
  string: { type: "string" },
  date: { type: "string", format: "date" },
  money: { type: "number", multipleOf: .01 },
  currency: { type: "string", pattern: "^[A-Z]{3}$" },
  iban: { type: "string", pattern: "^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$" },
  integer: { type: "integer" },
  number: { type: "number" },
};

const describe = (field: { label: string; description?: string }) => field.description ?? field.label;

/** The JSON schema the model is asked to fill, with every field required and nullable. */
export function toJsonSchema(schema: ExtractSchema): Record<string, unknown> {
  const property = (field: Omit<SchemaField, "group">) => ({ ...jsonType[field.type], type: [jsonType[field.type].type, "null"], description: describe(field) });
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: schema.title,
    ...(schema.description ? { description: schema.description } : {}),
    type: "object",
    additionalProperties: false,
    required: schema.fields.map(field => field.key),
    properties: Object.fromEntries(schema.fields.map(field => [field.key, field.type === "table"
      ? { type: "array", description: describe(field), items: { type: "object", additionalProperties: false, required: field.columns.map(column => column.key), properties: Object.fromEntries(field.columns.map(column => [column.key, property(column)])) } }
      : property(field)])),
  };
}

/** Parses a display value into its typed form, or returns undefined when it does not fit the type. */
export function parseValue(type: FieldType, raw: string): string | number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  switch (type) {
    case "string": return text;
    case "date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
      const date = new Date(`${text}T00:00:00Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : text;
    }
    case "currency": return /^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : undefined;
    case "iban": {
      const compact = text.replace(/\s+/g, "").toUpperCase();
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return undefined;
      const digits = (compact.slice(4) + compact.slice(0, 4)).replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
      let rest = 0;
      for (const char of digits) rest = (rest * 10 + Number(char)) % 97;
      return rest === 1 ? compact : undefined;
    }
    case "money": case "number": case "integer": {
      const number = Number(text.replace(/[\s,'’]/g, ""));
      if (!Number.isFinite(number)) return undefined;
      if (type === "integer") return Number.isInteger(number) ? number : undefined;
      return type === "money" ? Math.round(number * 100) / 100 : number;
    }
  }
}

export const typeHint: Record<FieldType, string> = {
  string: "Text",
  date: "Use YYYY-MM-DD",
  money: "Use a number such as 1,250.00",
  currency: "Use a three letter code such as EUR",
  iban: "This IBAN does not pass its check digits",
  integer: "Use a whole number",
  number: "Use a number",
};
