export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span style={{ color: "var(--accent2)", fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            STUNDLY
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
