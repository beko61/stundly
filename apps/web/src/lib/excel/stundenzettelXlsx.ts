/**
 * Stundenzettel-Vorlage als Excel (.xlsx): Blatt "Jahr" + 12 Monatsblätter mit Formeln
 * (Stunden = Ende − Beginn − Pause, auch über Mitternacht; „Urlaub“/„Krank“ = Soll pro Tag; Soll/Überstunden je Monat).
 * Wird komplett im Browser erzeugt — keine Eingaben verlassen das Gerät.
 */
import { getFeiertage, BUNDESLAENDER } from "@/lib/utils/feiertage";
import { MONATE } from "@/lib/pdf/stundenzettelVorlagePdf";
import { zipStore } from "./zipStore";

export interface ExcelVorlageInput {
  year: number;
  bundesland: string | null;
  name: string;
  firma: string;
}

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const FIRST = 6; // erste Tageszeile auf den Monatsblättern

export function excelFileName(i: ExcelVorlageInput): string {
  return `Stundenzettel_Vorlage_${i.year}.xlsx`;
}

/** Mo–Fr ohne Feiertage */
export function arbeitstage(year: number, month: number, feiertage: Record<string, string>): number {
  const days = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (feiertage[iso(year, month, d)]) continue;
    n++;
  }
  return n;
}

/** Zeilen der Summen auf einem Monatsblatt (für Verweise aus "Jahr") */
export function summenZeilen(year: number, month: number) {
  const last = FIRST + new Date(year, month, 0).getDate() - 1;
  return { last, summe: last + 2, arbeitstage: last + 3, soll: last + 4, ueber: last + 5 };
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function excelDate(y: number, m: number, d: number) {
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

// ── Styles ───────────────────────────────────────────────────────────────
// numFmt: 0 General · 164 Datum · 165 Uhrzeit · 166 Stunden · 167 ± Stunden
// font:   0 normal · 1 fett · 2 Titel · 3 Hinweis (grau, kursiv)
// fill:   0 none · 1 gray125 (Pflicht) · 2 Kopf · 3 Wochenende · 4 Feiertag
// border: 0 none · 1 dünn
class Styles {
  private xfs: string[] = ["0|0|0|0"];
  get(numFmt: number, font: number, fill: number, border: number): number {
    const k = `${numFmt}|${font}|${fill}|${border}`;
    let i = this.xfs.indexOf(k);
    if (i < 0) { this.xfs.push(k); i = this.xfs.length - 1; }
    return i;
  }
  xml(): string {
    const xf = this.xfs.map((k) => {
      const [n, f, fi, b] = k.split("|");
      return `<xf numFmtId="${n}" fontId="${f}" fillId="${fi}" borderId="${b}" xfId="0"` +
        `${n !== "0" ? ' applyNumberFormat="1"' : ""}${f !== "0" ? ' applyFont="1"' : ""}` +
        `${fi !== "0" ? ' applyFill="1"' : ""}${b !== "0" ? ' applyBorder="1"' : ""}/>`;
    }).join("");
    const fill = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<numFmts count="4"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/>` +
      `<numFmt numFmtId="166" formatCode="0.00"/><numFmt numFmtId="167" formatCode="+0.00;-0.00;0.00"/></numFmts>` +
      `<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>` +
      `<font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>` +
      `<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
      `${fill("FFDCE6F2")}${fill("FFEEEEEE")}${fill("FFFFF4D6")}</fills>` +
      `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right>` +
      `<top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${xf}</cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

// ── Zellen ───────────────────────────────────────────────────────────────
const str = (r: string, t: string, s = 0) => `<c r="${r}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${esc(t)}</t></is></c>`;
const num = (r: string, v: number, s = 0) => `<c r="${r}" s="${s}"><v>${v}</v></c>`;
const fml = (r: string, f: string, s = 0) => `<c r="${r}" s="${s}"><f>${esc(f)}</f></c>`;
const blank = (r: string, s: number) => `<c r="${r}" s="${s}"/>`;
const row = (n: number, cells: string[]) => `<row r="${n}">${cells.join("")}</row>`;

function sheetXml(cols: number[], rows: string[], freezeRow?: number) {
  const pane = freezeRow
    ? `<pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/></worksheet>`;
}

function monatsBlatt(st: Styles, i: ExcelVorlageInput, month: number, feiertage: Record<string, string>) {
  const { year } = i;
  const days = new Date(year, month, 0).getDate();
  const z = summenZeilen(year, month);
  const bold = st.get(0, 1, 0, 0);
  const head = st.get(0, 1, 2, 1);
  const rows: string[] = [
    row(1, [str("A1", `Stundenzettel ${MONATE[month - 1]} ${year}`, st.get(0, 2, 0, 0))]),
    row(2, [str("A2", "Name:", bold), str("B2", i.name), str("E2", "Firma:", bold), str("F2", i.firma)]),
    row(3, [str("A3", "Uhrzeiten als 7:30 eintragen, Pause in Minuten. „Urlaub“ oder „Krank“ in Bemerkung = Soll-Stunden des Tages. Summen rechnen sich selbst.", st.get(0, 3, 0, 0))]),
    row(5, ["Datum", "Tag", "Beginn", "Ende", "Pause (Min)", "Stunden", "Tätigkeit / Baustelle", "Bemerkung"]
      .map((t, k) => str(`${"ABCDEFGH"[k]}5`, t, head))),
  ];

  for (let d = 1; d <= days; d++) {
    const r = FIRST + d - 1;
    const dow = new Date(year, month - 1, d).getDay();
    const ft = feiertage[iso(year, month, d)];
    const fill = ft ? 4 : dow === 0 || dow === 6 ? 3 : 0;
    rows.push(row(r, [
      num(`A${r}`, excelDate(year, month, d), st.get(164, 0, fill, 1)),
      str(`B${r}`, WT[dow]!, st.get(0, 0, fill, 1)),
      blank(`C${r}`, st.get(165, 0, fill, 1)),
      blank(`D${r}`, st.get(165, 0, fill, 1)),
      blank(`E${r}`, st.get(0, 0, fill, 1)),
      fml(`F${r}`, `IF(OR(H${r}="Urlaub",H${r}="Krank"),Jahr!$B$4,IF(OR(C${r}="",D${r}=""),"",MOD(D${r}-C${r},1)*24-N(E${r})/60))`, st.get(166, 0, fill, 1)),
      blank(`G${r}`, st.get(0, 0, fill, 1)),
      ft ? str(`H${r}`, ft, st.get(0, 0, fill, 1)) : blank(`H${r}`, st.get(0, 0, fill, 1)),
    ]));
  }

  const sumNum = st.get(166, 1, 0, 1);
  rows.push(
    row(z.summe, [str(`A${z.summe}`, "Summe Stunden", bold), fml(`F${z.summe}`, `SUM(F${FIRST}:F${z.last})`, sumNum)]),
    row(z.arbeitstage, [str(`A${z.arbeitstage}`, "Arbeitstage (Mo–Fr ohne Feiertage)", bold), num(`F${z.arbeitstage}`, arbeitstage(year, month, feiertage), st.get(0, 1, 0, 1))]),
    row(z.soll, [str(`A${z.soll}`, "Soll-Stunden (Arbeitstage × Soll pro Tag im Blatt „Jahr“)", bold), fml(`F${z.soll}`, `F${z.arbeitstage}*Jahr!$B$4`, sumNum)]),
    row(z.ueber, [str(`A${z.ueber}`, "Überstunden (+) / Minusstunden (−)", bold), fml(`F${z.ueber}`, `F${z.summe}-F${z.soll}`, st.get(167, 1, 0, 1))]),
    row(z.ueber + 3, [str(`A${z.ueber + 3}`, "Unterschrift Mitarbeiter/in: ____________________"), str(`E${z.ueber + 3}`, "Unterschrift Vorgesetzte/r: ____________________")]),
  );
  return sheetXml([11, 5, 8, 8, 11, 9, 28, 22], rows, 5);
}

function jahresBlatt(st: Styles, i: ExcelVorlageInput) {
  const bold = st.get(0, 1, 0, 0);
  const head = st.get(0, 1, 2, 1);
  const cell = st.get(0, 0, 0, 1);
  const h = st.get(166, 0, 0, 1);
  const land = i.bundesland ? BUNDESLAENDER[i.bundesland] ?? i.bundesland : "keine eingetragen";
  const rows: string[] = [
    row(1, [str("A1", `Stundenzettel ${i.year} – Jahresübersicht`, st.get(0, 2, 0, 0))]),
    row(2, [str("A2", "Name:", bold), str("B2", i.name), str("D2", "Firma:", bold), str("E2", i.firma)]),
    row(4, [str("A4", "Soll-Stunden pro Arbeitstag:", bold), num("B4", 8, st.get(166, 1, 4, 1)), str("C4", "← hier anpassen", st.get(0, 3, 0, 0))]),
    row(5, [str("A5", `Feiertage: ${land}`, st.get(0, 3, 0, 0))]),
    row(7, ["Monat", "Ist-Stunden", "Arbeitstage", "Soll-Stunden", "Überstunden"].map((t, k) => str(`${"ABCDE"[k]}7`, t, head))),
  ];
  for (let m = 1; m <= 12; m++) {
    const r = 7 + m;
    const z = summenZeilen(i.year, m);
    const ref = `'${MONATE[m - 1]}'!`;
    rows.push(row(r, [
      str(`A${r}`, MONATE[m - 1]!, cell),
      fml(`B${r}`, `${ref}F${z.summe}`, h),
      fml(`C${r}`, `${ref}F${z.arbeitstage}`, cell),
      fml(`D${r}`, `${ref}F${z.soll}`, h),
      fml(`E${r}`, `${ref}F${z.ueber}`, st.get(167, 0, 0, 1)),
    ]));
  }
  const sumH = st.get(166, 1, 2, 1);
  rows.push(
    row(20, [
      str("A20", "Summe", head),
      fml("B20", "SUM(B8:B19)", sumH),
      fml("C20", "SUM(C8:C19)", st.get(0, 1, 2, 1)),
      fml("D20", "SUM(D8:D19)", sumH),
      fml("E20", "SUM(E8:E19)", st.get(167, 1, 2, 1)),
    ]),
    row(22, [str("A22", "Erstellt mit Stundly · stundly.de — Zeiten am Handy eintragen, Überstunden und Monats-PDF automatisch.", st.get(0, 3, 0, 0))]),
  );
  return sheetXml([30, 13, 12, 13, 13], rows);
}

/** Alle Dateien der .xlsx als Text (für Tests und zum Zippen) */
export function buildStundenzettelXlsxFiles(i: ExcelVorlageInput): Record<string, string> {
  const feiertage = i.bundesland ? getFeiertage(i.year, i.bundesland) : {};
  const st = new Styles();
  const sheets = [jahresBlatt(st, i), ...MONATE.map((_, k) => monatsBlatt(st, i, k + 1, feiertage))];
  const names = ["Jahr", ...MONATE];

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheets.map((_, k) => `<Override PartName="/xl/worksheets/sheet${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView/></bookViews><sheets>` +
      names.map((n, k) => `<sheet name="${esc(n)}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join("") +
      `</sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets.map((_, k) => `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${k + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  };
  sheets.forEach((xml, k) => { files[`xl/worksheets/sheet${k + 1}.xml`] = xml; });
  files["xl/styles.xml"] = st.xml(); // zuletzt: erst jetzt sind alle Styles registriert
  return files;
}

export function buildStundenzettelXlsx(i: ExcelVorlageInput): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  return zipStore(Object.entries(buildStundenzettelXlsxFiles(i)).map(([name, text]) => ({ name, data: enc.encode(text) })));
}
