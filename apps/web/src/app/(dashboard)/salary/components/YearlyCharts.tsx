"use client";

/**
 * İki yıllık genel bakış kartı:
 *   1. Otomatik hesaplama (time_entries × ayarlar) — parent'ta üretilen
 *      12 aylık `yearlyAuto` array'i.
 *   2. Manuel abrechnungen — kullanıcı salary_records tablosunda tuttuğu
 *      gerçek maaş kayıtları.
 * Her ikisi de aylık bar chart + toplamlar + legend.
 */

const MONTHS_S = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

type MonthlyAuto = {
  month:   number;
  brutto:  number;
  netto:   number;
  ndDays:  number;
};

type MonthRecord = {
  id:      string;
  user_id: string;
  year:    number;
  month:   number;
  brutto:  number;
  netto:   number;
  note:    string | null;
};

type Props = {
  year:                    number;
  month:                   number;
  yearlyAuto:              MonthlyAuto[];
  yearlyAutoMax:           number;
  yearlyAutoBruttoTotal:   number;
  yearlyAutoNettoTotal:    number;
  records:                 MonthRecord[];
  yearlyBrutto:            number;
  yearlyNetto:             number;
  yearlyMax:               number;
  fmtEurNoCents:           (n: number) => string;
};

export function YearlyCharts({
  year, month,
  yearlyAuto, yearlyAutoMax, yearlyAutoBruttoTotal, yearlyAutoNettoTotal,
  records, yearlyBrutto, yearlyNetto, yearlyMax,
  fmtEurNoCents,
}: Props) {
  return (
    <>
      {/* ── Auto-Jahresübersicht (Stundly berechnet) ── */}
      <div className="card purple">
        <div className="label" style={{ marginBottom: 8 }}>🤖 Jahres-Schätzung {year} (automatisch)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Brutto/Jahr",  val: fmtEurNoCents(yearlyAutoBruttoTotal), color: "var(--green)" },
            { label: "Netto/Jahr",   val: fmtEurNoCents(yearlyAutoNettoTotal),  color: "var(--accent2)"  },
            { label: "Ø Netto/Mon", val: fmtEurNoCents(yearlyAutoNettoTotal/12), color: "var(--blue)" },
          ].map(c => (
            <div key={c.label} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 6px" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: c.color }}>{c.val}</div>
            </div>
          ))}
        </div>

        {yearlyAutoBruttoTotal === 0 ? (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
            Noch keine Zeiteinträge für {year}.
          </div>
        ) : (
          Array.from({ length: 12 }, (_, i) => {
            const a = yearlyAuto[i]!;
            const bPct = Math.round((a.brutto / yearlyAutoMax) * 100);
            const nPct = Math.round((a.netto  / yearlyAutoMax) * 100);
            const isEmpty = a.brutto === 0;
            return (
              <div key={a.month} style={{ marginBottom: 7, opacity: isEmpty ? 0.3 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: a.month === month ? "var(--accent2)" : "var(--muted)", fontWeight: 700, width: 28 }}>{MONTHS_S[i]}</span>
                  {isEmpty ? (
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
                  ) : (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
                      B: {fmtEurNoCents(a.brutto)} · N: {fmtEurNoCents(a.netto)}
                    </span>
                  )}
                </div>
                <div style={{ position: "relative", height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: "var(--green)", borderRadius: 4, transition: "width 0.4s" }} />
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nPct}%`, background: "var(--accent2)", borderRadius: 4, opacity: 0.7, transition: "width 0.4s" }} />
                </div>
              </div>
            );
          })
        )}

        {yearlyAutoBruttoTotal > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {[["var(--green)","Brutto"],["var(--accent2)","Netto"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, lineHeight: 1.4 }}>
          ℹ️ Basierend auf Zeiteinträgen × Stundenlohn × Steuereinstellungen.
          Schätzung — die echte Lohnabrechnung kann ±5% abweichen.
        </div>
      </div>

      {/* ── Manuelle Jahresübersicht (Abrechnungen) ── */}
      <div className="card">
        <div className="label" style={{ marginBottom: 6 }}>📊 Echte Abrechnungen {year}</div>

        {/* Totals */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Brutto",  val: fmtEurNoCents(yearlyBrutto), color: "var(--green)" },
            { label: "Netto",   val: fmtEurNoCents(yearlyNetto),  color: "var(--blue)"  },
            { label: "Steuer",  val: fmtEurNoCents(yearlyBrutto - yearlyNetto), color: "var(--red)" },
          ].map(c => (
            <div key={c.label} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 10, padding: "10px 6px" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 500, color: c.color }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Monthly bars */}
        {records.length === 0 ? (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "12px 0" }}>
            Noch keine Einträge für {year}.
          </div>
        ) : (
          Array.from({ length: 12 }, (_, i) => {
            const m   = i + 1;
            const rec = records.find(r => r.month === m);
            const bPct = rec ? Math.round((rec.brutto / yearlyMax) * 100) : 0;
            const nPct = rec ? Math.round((rec.netto  / yearlyMax) * 100) : 0;
            return (
              <div key={m} style={{ marginBottom: 7, opacity: rec ? 1 : 0.35 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: m === month ? "var(--accent2)" : "var(--muted)", fontWeight: 700, width: 28 }}>{MONTHS_S[i]}</span>
                  {rec ? (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted)" }}>
                      B: {fmtEurNoCents(rec.brutto)} · N: {fmtEurNoCents(rec.netto)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
                  )}
                </div>
                <div style={{ position: "relative", height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: "var(--green)", borderRadius: 4, transition: "width 0.4s" }} />
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${nPct}%`, background: "var(--blue)", borderRadius: 4, opacity: 0.6, transition: "width 0.4s" }} />
                </div>
              </div>
            );
          })
        )}

        {/* Legend */}
        {records.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {[["var(--green)","Brutto"],["var(--blue)","Netto"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
