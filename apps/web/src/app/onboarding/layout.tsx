export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{
            color: "var(--accent2)", fontSize: 13, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase"
          }}>
            WORKLY
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
