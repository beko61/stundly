"use client";

/**
 * Monatliche Gehalts-Abrechnung eintragen/bearbeiten Modal.
 * Kontrollierte Komponente — state parent'ta (open, brutto, netto, note,
 * saving flag). Modal sadece render + input events + save/delete callback.
 */

const MONTHS = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

type Props = {
  open: boolean;
  month: number;
  year: number;
  brutto: string;
  netto: string;
  note: string;
  saving: boolean;
  hasExistingRecord: boolean;
  fmtEur: (n: number) => string;
  onClose: () => void;
  onBruttoChange: (v: string) => void;
  onNettoChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function RecordModal({
  open, month, year, brutto, netto, note, saving, hasExistingRecord,
  fmtEur, onClose, onBruttoChange, onNettoChange, onNoteChange, onSave, onDelete,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>🧾 {MONTHS[month-1]} {year}</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "6px 10px" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Brutto erhalten (€)</label>
              <input className="input" type="number" step="0.01" value={brutto}
                onChange={e => onBruttoChange(e.target.value)} placeholder="z.B. 2500.00" />
            </div>
            <div>
              <label className="label">Netto erhalten (€)</label>
              <input className="input" type="number" step="0.01" value={netto}
                onChange={e => onNettoChange(e.target.value)} placeholder="z.B. 1800.00" />
            </div>
          </div>

          {brutto && netto && (
            <div style={{
              background: "color-mix(in srgb, var(--red) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
              borderRadius: 10, padding: "10px 14px",
              display: "flex", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Steuer / Abzüge</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                {fmtEur(parseFloat(brutto||"0") - parseFloat(netto||"0"))}
              </span>
            </div>
          )}

          <div>
            <label className="label">Notiz (optional)</label>
            <input className="input" type="text" value={note}
              onChange={e => onNoteChange(e.target.value)} placeholder="z.B. Bonus, Sonderzahlung..." />
          </div>

          <button className="btn btn-primary" onClick={onSave} disabled={saving || !brutto} style={{ width: "100%" }}>
            {saving ? "Speichern..." : "💾 Speichern"}
          </button>

          {hasExistingRecord && (
            <button onClick={onDelete} style={{
              width: "100%", padding: 12, background: "transparent",
              border: "1px solid var(--red)", borderRadius: 12, color: "var(--red)",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              🗑 Eintrag löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
