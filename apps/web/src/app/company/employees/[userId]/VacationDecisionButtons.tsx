"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  vacationId: string;
  startDate:  string;
  endDate:    string;
  daysCount:  number;
}

export function VacationDecisionButtons({ vacationId, startDate, endDate, daysCount }: Props) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason,     setReason]     = useState("");
  const [busy,       setBusy]       = useState<"approve" | "reject" | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  async function send(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(`/api/vacation/${vacationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          ...(decision === "rejected" && reason ? { reason } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Fehler beim Speichern");
        setBusy(null);
        return;
      }
      setShowReject(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setBusy(null);
    }
  }

  if (showReject) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: 8,
        background: "color-mix(in srgb, var(--red) 6%, var(--surface))",
        border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
        borderRadius: 10, padding: 12, marginTop: 8, width: "100%",
      }}>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Antrag {startDate} – {endDate} ({daysCount} Tage) ablehnen?
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Begründung (optional, wird per Mail mitgeteilt)"
          rows={2}
          style={{
            width: "100%", padding: "8px 10px", borderRadius: 8,
            background: "var(--bg)", border: "1px solid var(--border)",
            color: "var(--text)", fontSize: 12, fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        {error && (
          <div style={{ fontSize: 11, color: "var(--red)" }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => send("rejected")}
            disabled={busy !== null}
            style={{
              flex: 1, padding: "7px 12px", borderRadius: 8,
              background: "var(--red)", color: "white", border: "none",
              fontWeight: 700, fontSize: 12, cursor: busy ? "wait" : "pointer",
              fontFamily: "'Syne',sans-serif",
            }}
          >
            {busy === "reject" ? "Speichern…" : "Endgültig ablehnen"}
          </button>
          <button
            onClick={() => { setShowReject(false); setReason(""); setError(null); }}
            disabled={busy !== null}
            style={{
              padding: "7px 12px", borderRadius: 8,
              background: "var(--surface2)", color: "var(--text)",
              border: "1px solid var(--border)",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              fontFamily: "'Syne',sans-serif",
            }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {error && (
        <div style={{ width: "100%", fontSize: 11, color: "var(--red)", marginBottom: 4 }}>
          {error}
        </div>
      )}
      <button
        onClick={() => send("approved")}
        disabled={busy !== null}
        style={{
          padding: "7px 14px", borderRadius: 8,
          background: "var(--green)", color: "#0f0f13", border: "none",
          fontWeight: 800, fontSize: 12, cursor: busy ? "wait" : "pointer",
          fontFamily: "'Syne',sans-serif",
        }}
      >
        {busy === "approve" ? "..." : "✓ Genehmigen"}
      </button>
      <button
        onClick={() => setShowReject(true)}
        disabled={busy !== null}
        style={{
          padding: "7px 14px", borderRadius: 8,
          background: "transparent", color: "var(--red)",
          border: "1px solid var(--red)",
          fontWeight: 800, fontSize: 12, cursor: "pointer",
          fontFamily: "'Syne',sans-serif",
        }}
      >
        ✕ Ablehnen
      </button>
    </div>
  );
}
