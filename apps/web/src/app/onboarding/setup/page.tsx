"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DemoDataBadge } from "@/components/ui/DemoDataBadge";

const BUNDESLAENDER = [
  { code: "BB", name: "Brandenburg" },
  { code: "BE", name: "Berlin" },
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "HB", name: "Bremen" },
  { code: "HE", name: "Hessen" },
  { code: "HH", name: "Hamburg" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "TH", name: "Thüringen" },
];

function SetupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type") ?? "individual";
  const isCompany = type === "company";

  const [companyName, setCompanyName] = useState("");
  const [bundesland, setBundesland] = useState(""); // Kullanıcı bilinçli seçsin
  const [vatId, setVatId] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Kullanıcı giriş yapmamışsa login'e yönlendir
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // GÜVENLİK: role/company_id direkt client'tan yazılmaz. Migration 021'deki
    // enforce_profile_privileges trigger'ı bunu bloklar. Server route'lar
    // service_role ile bu değişikliği yapar.
    if (isCompany) {
      const res = await fetch("/api/onboarding/create-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          bundesland,
          vat_id: vatId || undefined,
          city:   city  || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Fehler beim Erstellen des Unternehmens.");
        setLoading(false);
        return;
      }
      // Server az önce role'u company_admin yaptı — JWT user_role claim'i
      // fresh olsun (migration 028 hook). Yoksa /company/dashboard reddedilir.
      await supabase.auth.refreshSession();
      router.push("/onboarding/done?type=company");
    } else {
      const res = await fetch("/api/onboarding/set-bundesland", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundesland }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Fehler beim Speichern.");
        setLoading(false);
        return;
      }
      router.push("/onboarding/done?type=individual");
    }
  }

  return (
    <div className="card" style={{ padding: "32px 24px" }}>
      {/* Adım göstergesi */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: s <= 2 ? "var(--accent2)" : "var(--border)",
          }} />
        ))}
      </div>

      <DemoDataBadge />

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        {isCompany ? "Unternehmen einrichten" : "Dein Profil einrichten"}
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
        {isCompany
          ? "Gib die Grunddaten deines Unternehmens ein."
          : "Ein paar Angaben, damit Stundly optimal für dich funktioniert."}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {isCompany && (
          <>
            <div>
              <label className="label">Unternehmensname *</label>
              <input
                className="input"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Mustermann GmbH"
                required
              />
            </div>

            <div>
              <label className="label">Stadt</label>
              <input
                className="input"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Berlin"
              />
            </div>

            <div>
              <label className="label">USt-IdNr. (optional)</label>
              <input
                className="input"
                type="text"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
                placeholder="DE123456789"
              />
            </div>
          </>
        )}

        <div>
          <label className="label">Bundesland *</label>
          <select
            className="input"
            value={bundesland}
            onChange={(e) => setBundesland(e.target.value)}
            required
          >
            <option value="" disabled>Bitte auswählen…</option>
            {BUNDESLAENDER.map((bl) => (
              <option key={bl.code} value={bl.code}>{bl.name}</option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Bestimmt die gesetzlichen Feiertage in deinem Bundesland.
          </p>
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

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/onboarding/type")}
            style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            Zurück
          </button>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ flex: 2 }}>
            {loading ? "Bitte warten..." : "Weiter"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OnboardingSetupPage() {
  return (
    <Suspense fallback={<div className="card" style={{ padding: 32, textAlign: "center" }}>Laden...</div>}>
      <SetupForm />
    </Suspense>
  );
}
