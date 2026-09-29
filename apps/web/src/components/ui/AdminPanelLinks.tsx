"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Zugang zu Firmen-Panel / Süper-Admin-Panel auf dem Handy — die Sidebar (mit diesen
 * Links) ist mobil ausgeblendet und die BottomNav hat keinen Platz dafür.
 * Wird oben auf der Profil-Seite gezeigt, nur für company_admin / super_admin.
 */
export function AdminPanelLinks() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("profiles").select("role").eq("user_id", session.user.id).maybeSingle();
      if (!cancelled) setRole((data?.role as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  if (role !== "company_admin" && role !== "super_admin") return null;

  const base = {
    flex: 1, minWidth: 150, display: "flex", alignItems: "center", gap: 8,
    padding: "14px 16px", borderRadius: 12, textDecoration: "none", fontSize: 14, fontWeight: 800,
  } as const;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link href="/company/dashboard" style={{
        ...base, color: "var(--accent2)",
        background: "color-mix(in srgb, var(--accent2) 14%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent2) 35%, transparent)",
      }}>
        <span aria-hidden="true">🏢</span> Firma-Panel <span style={{ marginLeft: "auto" }} aria-hidden="true">→</span>
      </Link>
      {role === "super_admin" && (
        <Link href="/superadmin" style={{
          ...base, color: "var(--red)",
          background: "color-mix(in srgb, var(--red) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)",
        }}>
          <span aria-hidden="true">🛡</span> Admin Panel <span style={{ marginLeft: "auto" }} aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
