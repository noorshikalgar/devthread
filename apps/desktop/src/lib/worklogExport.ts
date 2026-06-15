// Minimal XLSX writer — no external dependencies. An .xlsx file is
// just a ZIP archive of XML documents. We use the STORE method (no
// compression) so the writer is straightforward and the file is
// still small for a year of worklog data.
//
// Spec references:
//   - ECMA-376 Part 1 (Office Open XML)
//   - PKWARE APPNOTE.TXT (ZIP)

// ---------- ZIP writer (STORE method) ----------

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function buildZip(
  entries: Array<{ name: string; content: string }>,
): Uint8Array {
  const dosTime = (() => {
    const d = new Date();
    return (
      ((d.getHours() & 0x1f) << 11) |
      ((d.getMinutes() & 0x3f) << 5) |
      ((d.getSeconds() >>> 1) & 0x1f)
    );
  })();
  const dosDate = (() => {
    const d = new Date();
    return (
      (((d.getFullYear() - 1980) & 0x7f) << 9) |
      (((d.getMonth() + 1) & 0xf) << 5) |
      (d.getDate() & 0x1f)
    );
  })();

  const encoder = new TextEncoder();
  const built: ZipEntry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dosTime, true);
    view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    built.push({ nameBytes, data, crc, offset });
    chunks.push(header, data);
    offset += header.length + data.length;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const entry of built) {
    const record = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    record.set(entry.nameBytes, 46);
    chunks.push(record);
    centralDirSize += record.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, built.length, true);
  eocdView.setUint16(10, built.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, centralDirStart, true);
  eocdView.setUint16(20, 0, true);
  chunks.push(eocd);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

// ---------- XLSX XML generators ----------

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const STYLE_HEADER = 1;
const STYLE_GOAL_HIT = 2; // ≥100% of goal — emerald
const STYLE_MUTED = 3; // muted text for empty / 0-minute rows
const STYLE_PERCENT = 4; // 0% number format
const STYLE_NEAR_GOAL = 5; // 70-99% of goal — amber
const STYLE_PARTIAL = 6; // 40-69% of goal — sky
const STYLE_BANDED = 7; // zebra row banding — light slate
const STYLE_GUIDE_SECTION = 8; // Guide sheet section title — light yellow, bold black, wrap
const STYLE_BODY_WRAP = 9; // default text with wrapText — used for free-form prose cells

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FF6B7280"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF10B981"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF59E0B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF38BDF8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF374151"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="3" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function workbookRelsXml(sheetCount: number): string {
  let rels = "";
  for (let i = 1; i <= sheetCount; i++) {
    rels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${rels}
</Relationships>`;
}

function workbookXml(
  sheets: Array<{ name: string; tabColor?: string }>,
): string {
  const sheetEls = sheets
    .map((s, i) => {
      const tabColor = s.tabColor
        ? `<sheetPr><tabColor rgb="FF${s.tabColor}"/></sheetPr>`
        : "";
      return `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}">${tabColor}</sheet>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEls}</sheets>
</workbook>`;
}

export interface SheetCell {
  value: string | number;
  style?: number;
  // When true, render the cell with wrapText alignment so long content
  // flows across multiple lines inside the cell. The cell's style must
  // also carry the wrapText alignment (use `styles.bodyWrap` or
  // `styles.guideSection`).
  wrap?: boolean;
}

function columnLetter(index: number): string {
  let s = "";
  let n = index;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

function buildSheetXml(
  rows: SheetCell[][],
  options: { columnWidths?: number[]; freezeHeader?: boolean } = {},
): string {
  const { columnWidths, freezeHeader = false } = options;
  const rowEls = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`;
          // `wrap` falls back to the cell's style index — if the style
          // already has wrapText (e.g. guideSection, bodyWrap), we
          // don't need to mark the cell again.
          const effectiveStyle =
            cell.wrap && cell.style === undefined ? styles.bodyWrap : cell.style;
          const styleAttr =
            effectiveStyle !== undefined ? ` s="${effectiveStyle}"` : "";
          if (typeof cell.value === "number") {
            return `<c r="${ref}"${styleAttr}><v>${cell.value}</v></c>`;
          }
          if (cell.value === "") {
            return `<c r="${ref}"${styleAttr}/>`;
          }
          return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t>${xmlEscape(String(cell.value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  // Column widths are in "Excel character units". 8 is the Excel
  // minimum that still renders the cell with a visible border.
  const cols = columnWidths?.length
    ? `<cols>${columnWidths
        .map((width, index) => {
          const w = Math.max(8, width);
          return `<col min="${index + 1}" max="${index + 1}" width="${w.toFixed(2)}" customWidth="1"/>`;
        })
        .join("")}</cols>`
    : "";
  // Frozen header: pane is split after row 1, so the header
  // stays pinned when the user scrolls.
  const sheetView = freezeHeader
    ? `<sheetViews><sheetView tabSelected="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${sheetView}${cols}<sheetData>${rowEls}</sheetData>
</worksheet>`;
}

function buildContentTypes(sheetCount: number): string {
  let overrides = "";
  for (let i = 1; i <= sheetCount; i++) {
    overrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overrides}
</Types>`;
}

// ---------- Public API ----------

export interface ExportSheet {
  name: string;
  rows: SheetCell[][];
  // Optional per-column widths in Excel character units.
  columnWidths?: number[];
  // Optional sheet tab color (ARGB hex without the alpha).
  tabColor?: string;
  // Freeze the first row so headers stay visible while scrolling.
  freezeHeader?: boolean;
}

export function buildWorkbook(sheets: ExportSheet[]): Uint8Array {
  return buildZip([
    { name: "[Content_Types].xml", content: buildContentTypes(sheets.length) },
    { name: "_rels/.rels", content: ROOT_RELS_XML },
    { name: "xl/workbook.xml", content: workbookXml(sheets) },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: workbookRelsXml(sheets.length),
    },
    { name: "xl/styles.xml", content: STYLES_XML },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      content: buildSheetXml(sheet.rows, {
        columnWidths: sheet.columnWidths,
        freezeHeader: sheet.freezeHeader,
      }),
    })),
  ]);
}

export const styles = {
  default: 0,
  header: STYLE_HEADER,
  goalHit: STYLE_GOAL_HIT,
  muted: STYLE_MUTED,
  percent: STYLE_PERCENT,
  nearGoal: STYLE_NEAR_GOAL,
  partial: STYLE_PARTIAL,
  banded: STYLE_BANDED,
  guideSection: STYLE_GUIDE_SECTION,
  bodyWrap: STYLE_BODY_WRAP,
} as const;
