import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CycleReportData } from "./data.ts";
import {
  displayCurrency,
  displayNumber,
  displayValue,
  formatDate,
  formatDateTime,
  sanitizePdfText,
} from "./format.ts";
import { buildWaterQualityMetrics, getCycleDurationDays } from "./stats.ts";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const LINE_HEIGHT = 14;

type PdfContext = {
  doc: PDFDocument;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
};

const wrapText = (text: string, maxChars = 90) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const ensureSpace = (ctx: PdfContext, needed = LINE_HEIGHT) => {
  if (ctx.y - needed >= MARGIN) {
    return ctx;
  }

  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
  return ctx;
};

const drawLine = (
  ctx: PdfContext,
  text: string,
  options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> },
) => {
  const size = options?.size ?? 10;
  const font = options?.bold ? ctx.fontBold : ctx.font;
  const safeText = sanitizePdfText(text);
  ensureSpace(ctx, size + 4);
  ctx.page.drawText(safeText, {
    x: MARGIN,
    y: ctx.y,
    size,
    font,
    color: options?.color ?? rgb(0.08, 0.12, 0.18),
  });
  ctx.y -= size + 4;
  return ctx;
};

const drawSectionTitle = (ctx: PdfContext, title: string) => {
  ensureSpace(ctx, 28);
  ctx.y -= 8;
  drawLine(ctx, title, { bold: true, size: 13, color: rgb(0.02, 0.32, 0.78) });
  ctx.y -= 4;
  return ctx;
};

const drawKeyValue = (ctx: PdfContext, label: string, value: string) => {
  const line = `${label}: ${value}`;
  for (const wrapped of wrapText(line, 95)) {
    drawLine(ctx, wrapped);
  }
  return ctx;
};

const drawTableHeader = (ctx: PdfContext, columns: string[]) => {
  drawLine(ctx, columns.join(" | "), { bold: true, size: 9 });
  return ctx;
};

export async function buildCycleReportPdf(data: CycleReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let ctx: PdfContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    font,
    fontBold,
  };

  const { cycle, pond, logs, cycleExpenses, reportTitle } = data;
  const durationDays = getCycleDurationDays(cycle);
  const waterMetrics = buildWaterQualityMetrics(logs);
  const generatedAt = new Date().toLocaleString("en-IN");

  drawLine(ctx, "AquaPrana", { bold: true, size: 22, color: rgb(0.02, 0.32, 0.78) });
  drawLine(ctx, reportTitle, { bold: true, size: 16 });
  drawLine(ctx, `Generated: ${generatedAt}`, { size: 9, color: rgb(0.4, 0.45, 0.5) });
  ctx.y -= 8;

  drawSectionTitle(ctx, "Cycle Summary");
  drawKeyValue(ctx, "Pond", displayValue(pond.name));
  drawKeyValue(ctx, "Species", displayValue(cycle.species));
  drawKeyValue(ctx, "Category", displayValue(cycle.category));
  drawKeyValue(ctx, "Stocking Date", formatDate(String(cycle.stocking_date ?? "")));
  drawKeyValue(
    ctx,
    "Harvest / Closed Date",
    formatDate(String(cycle.actual_harvest_date ?? cycle.closed_at ?? "")),
  );
  drawKeyValue(ctx, "Cycle Duration (days)", displayValue(durationDays));
  drawKeyValue(ctx, "Status", displayValue(cycle.status));
  drawKeyValue(ctx, "Outcome", displayValue(cycle.outcome));

  drawSectionTitle(ctx, "Production Outcomes");
  drawKeyValue(ctx, "Final ABW (g)", displayNumber(Number(cycle.current_abw_g)));
  drawKeyValue(
    ctx,
    "Final Biomass (kg)",
    displayNumber(Number(cycle.current_biomass_kg), 1),
  );
  drawKeyValue(ctx, "Survival Rate (%)", displayNumber(Number(cycle.survival_rate), 1));
  drawKeyValue(ctx, "FCR", displayNumber(Number(cycle.estimated_fcr), 2));
  drawKeyValue(
    ctx,
    "Total Feed Used (kg)",
    displayNumber(Number(cycle.total_feed_used_kg), 2),
  );
  drawKeyValue(
    ctx,
    "Harvest Weight (kg)",
    displayNumber(Number(cycle.harvest_weight_kg), 2),
  );

  drawSectionTitle(ctx, "Water Quality Summary");
  if (logs.length === 0) {
    drawLine(ctx, "Not Recorded");
  } else {
    drawTableHeader(ctx, ["Parameter", "Min", "Max", "Average"]);
    for (const metric of waterMetrics) {
      drawLine(
        ctx,
        `${metric.label} | ${displayNumber(metric.min)} | ${displayNumber(metric.max)} | ${displayNumber(metric.avg)}`,
        { size: 9 },
      );
    }
  }

  drawSectionTitle(ctx, "Expense Summary");
  if (!cycleExpenses) {
    drawLine(ctx, "Not Recorded");
  } else {
    drawKeyValue(ctx, "Feed Cost", displayCurrency(Number(cycleExpenses.feed_cost)));
    drawKeyValue(ctx, "Seed Cost", displayCurrency(Number(cycleExpenses.seed_cost)));
    drawKeyValue(ctx, "Labour Cost", displayCurrency(Number(cycleExpenses.labour_cost)));
    drawKeyValue(
      ctx,
      "Treatment Cost",
      displayCurrency(Number(cycleExpenses.treatment_cost)),
    );
    drawKeyValue(ctx, "Other Cost", displayCurrency(Number(cycleExpenses.other_cost)));
    drawKeyValue(ctx, "Total Cost", displayCurrency(Number(cycleExpenses.total_cost)));
    drawKeyValue(
      ctx,
      "Cost / kg",
      cycleExpenses.cost_per_kg != null
        ? displayCurrency(Number(cycleExpenses.cost_per_kg))
        : "Not Recorded",
    );
  }

  drawSectionTitle(ctx, "Full Pond Log History");
  if (logs.length === 0) {
    drawLine(ctx, "Not Recorded");
  } else {
    drawTableHeader(ctx, [
      "Date",
      "DO",
      "pH",
      "Temp",
      "Feed",
      "Mort",
      "ABW",
    ]);

    for (const log of logs) {
      ensureSpace(ctx, LINE_HEIGHT);
      drawLine(
        ctx,
        [
          formatDateTime(String(log.observed_at ?? "")),
          displayNumber(Number(log.do_mgl), 1),
          displayNumber(Number(log.ph), 2),
          displayNumber(Number(log.temp_c), 1),
          displayNumber(Number(log.feed_qty_kg), 2),
          displayNumber(Number(log.mortality_count), 0),
          displayNumber(Number(log.abw_g), 1),
        ].join(" | "),
        { size: 8 },
      );
    }
  }

  return doc.save();
}
