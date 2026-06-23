"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isBetaActive, BETA_END_DATE_LABEL } from "@/lib/beta";
import { createClient } from "@/lib/supabase/client";
import {
  hasDemoEdits,
  getDemoEntriesForImport,
  clearDemoStorage,
  type DemoEntry,
} from "@/app/demo/state";

type ImportStatus = "checking" | "idle" | "prompt" | "importing" | "done" | "failed";

function DoneContent() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type") ?? "individual";
  const isCompany = type === "company";
  const welcomeSent = useRef(false);

  const [importStatus, setImportStatus] = useState<ImportStatus>("checking");
  const [demoEntries,  setDemoEntries]  = useState<DemoEntry[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [importError,   setImportError]   = useState<string | null>(null);

  // Welcome maili tetikle (RESEND_API_KEY varsa, yoksa sessiz başarısız)
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;
    void fetch("/api/email/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: isCompany ? "company" : "individual" }),
    }).catch(() => { /* sessizce yut */ });
  }, [isCompany]);

  // Demo entry'leri kontrol et — kullanıcı editlemiş mi?
  useEffect(() => {
    if (!hasDemoEdits()) {
      setImportStatus("idle");
      return;
    }
    const entries = getDemoEntriesForImport();
    if (entries.length === 0) {
      setImportStatus("idle");
      return;
    }
    setDemoEntries(entries);
    setImportStatus("prompt");
  }, []);

  async function handleImport() {
    setImportStatus("importing");
    setImportError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setImportError("Anmeldesitzung verloren. Bitte erneut anmelden.");
      setImportStatus("failed");
      return;
    }

    // DemoEntry → time_entries shape
    const rows = demoEntries.map((e) => ({
      user_id:       user.id,
      date:          e.date,
      day_type:      e.day_type,
      start_time:    e.start_time,
      end_time:      e.end_time,
      break_minutes: e.break_minutes,
    }));

    const { error, data } = await supabase
      .from("time_entries")
      .upsert(rows, { onConflict: "user_id,date" })
      .select("id");

    if (error) {
      setImportError(error.message);
      setImportStatus("failed");
      return;
    }

    clearDemoStorage();
    setImportedCount(data?.length ?? rows.length);
    setImportStatus("done");
  }

  function handleDiscard() {
    clearDemoStorage();
    setImportStatus("idle");
  }

  return (
    <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
      {/* Adım göstergesi */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: "var(--accent2)",
          }} />
        ))}
      </div>

      <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>
        Alles bereit!
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
        {isCompany
          ? "Dein Unternehmen wurde erfolgreich eingerichtet."
          : "Dein Konto ist fertig eingerichtet."}
      </p>

      <div style={{
        background: "color-mix(in srgb, var(--accent2) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent2) 30%, transparent)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 20,
        fontSize: 13, color: "var(--accent2)", fontWeight: 600,
      }}>
        {isBetaActive()
          ? `🎁 Beta-Phase: Alle Funktionen 3 Monate kostenlos bis ${BETA_END_DATE_LABEL}`
          : "✓ 14 Tage kostenlos testen – keine Kreditkarte erforderlich"}
      </div>

      {/* Demo-Daten Import Prompt */}
      {importStatus === "prompt" && (
        <div style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--green) 12%, transparent), color-mix(in srgb, var(--accent2) 12%, transparent))",
          border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
          borderRadius: 12, padding: "18px 20px", marginBottom: 24,
          textAlign: "left",
        }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>💾</div>
          <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
            Du hast {demoEntries.length} Einträge aus dem Demo — übernehmen?
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
            Wir kopieren sie in dein neues Konto. Du kannst sie danach in der Zeiterfassung
            bearbeiten oder löschen.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleDiscard}
              className="btn"
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: 13,
                minHeight: 42,
              }}
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="btn btn-primary"
              style={{ flex: 2, fontSize: 13, minHeight: 42 }}
            >
              ✓ Übernehmen
            </button>
          </div>
        </div>
      )}

      {importStatus === "importing" && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          fontSize: 13, color: "var(--muted)",
        }}>
          ⏳ Importiere deine Demo-Daten…
        </div>
      )}

      {importStatus === "done" && (
        <div style={{
          background: "color-mix(in srgb, var(--green) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--green) 35%, transparent)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          fontSize: 13, color: "var(--green)", fontWeight: 700, textAlign: "left",
        }}>
          ✅ {importedCount} Einträge übernommen — du findest sie in der Zeiterfassung.
        </div>
      )}

      {importStatus === "failed" && (
        <div style={{
          background: "color-mix(in srgb, var(--red) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 24,
          fontSize: 13, color: "var(--red)", textAlign: "left",
        }}>
          ⚠️ Import fehlgeschlagen{importError ? `: ${importError}` : ""}.
          Du kannst die Einträge auch manuell in der Zeiterfassung anlegen.
        </div>
      )}

      {isCompany && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", marginBottom: 24,
          textAlign: "left",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
            Nächste Schritte:
          </p>
          <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 2, paddingLeft: 18 }}>
            <li>Mitarbeiter über das Admin-Panel einladen</li>
            <li>Arbeitszeitregeln konfigurieren</li>
            <li>Berichte & Exporte einrichten</li>
          </ul>
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={() => router.push(isCompany ? "/company/dashboard" : "/dashboard")}
        disabled={importStatus === "importing"}
        style={{ width: "100%", fontSize: 16, padding: "14px" }}
      >
        {isCompany ? "Zum Admin-Panel" : "Jetzt starten"}
      </button>
    </div>
  );
}

export default function OnboardingDonePage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
      <DoneContent />
    </Suspense>
  );
}
