"use client";

import { useState } from "react";

export function ContactForm() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot — kullanıcı görmez
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/contact", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, subject, message, website }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json?.error ?? "Nachricht konnte nicht gesendet werden.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="card" style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Vielen Dank!</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          Deine Nachricht ist angekommen. Ich melde mich meistens innerhalb von 24h zurück
          — direkt an <strong style={{ color: "var(--text)" }}>{email}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            setName(""); setEmail(""); setSubject(""); setMessage(""); setSent(false);
          }}
          className="btn"
          style={{
            padding: "10px 22px",
            background: "var(--surface2)", border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          Weitere Nachricht senden
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: "24px 22px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Max Mustermann"
            required
            minLength={2}
            autoComplete="name"
          />
        </div>

        <div>
          <label className="label">E-Mail</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="deine@email.de"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label">Betreff (optional)</label>
          <input
            className="input"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="z.B. Bug, Feature-Wunsch, Frage zur Abrechnung"
            maxLength={200}
          />
        </div>

        <div>
          <label className="label">Nachricht</label>
          <textarea
            className="input"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Schreib mir, was los ist…"
            required
            minLength={15}
            maxLength={5000}
            rows={7}
            style={{ fontFamily: "inherit", resize: "vertical", minHeight: 140 }}
          />
          <div style={{
            fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 4,
          }}>
            {message.length} / 5000
          </div>
        </div>

        {/* Honeypot — düz CSS ile gizli, sekme erişimi de yok */}
        <div aria-hidden="true" style={{
          position: "absolute", left: "-9999px",
          width: 1, height: 1, opacity: 0, pointerEvents: "none",
        }}>
          <label>
            Webseite (nicht ausfüllen)
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={e => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p style={{
            color: "var(--red)", fontSize: 13,
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            padding: "10px 12px", borderRadius: 8,
          }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading}
          style={{ marginTop: 4, fontSize: 14, padding: "12px 24px" }}
        >
          {loading ? "Senden…" : "Nachricht senden"}
        </button>

        <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
          Mit dem Senden bestätigst du, dass deine Angaben gemäß unserer{" "}
          <a href="/datenschutz" style={{ color: "var(--accent2)" }}>Datenschutzerklärung</a> verarbeitet werden.
        </p>
      </div>
    </form>
  );
}
