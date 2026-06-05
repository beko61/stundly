"use client";

import { useRouter } from "next/navigation";

const options = [
  {
    type: "individual",
    icon: "👤",
    title: "Einzelperson",
    subtitle: "Ich tracke meine eigene Arbeitszeit",
    desc: "Perfekt für Freelancer, Handwerker und Einzelunternehmer.",
  },
  {
    type: "company",
    icon: "🏢",
    title: "Unternehmen",
    subtitle: "Ich verwalte ein Team",
    desc: "Für Firmen, die Mitarbeiter einladen und verwalten möchten.",
  },
];

export default function OnboardingTypePage() {
  const router = useRouter();

  return (
    <div className="card" style={{ padding: "32px 24px" }}>
      {/* Adım göstergesi */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            height: 4, flex: 1, borderRadius: 2,
            background: s === 1 ? "var(--accent2)" : "var(--border)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        Wie möchtest du Workly nutzen?
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
        Wähle die passende Option für dich aus.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => router.push(`/onboarding/setup?type=${opt.type}`)}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "18px 20px",
              textAlign: "left",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.1s",
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent2)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 2 }}>
                {opt.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--accent2)", fontWeight: 600, marginBottom: 4 }}>
                {opt.subtitle}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                {opt.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
