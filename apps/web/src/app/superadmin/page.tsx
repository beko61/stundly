import Link from "next/link";
import { adminClient } from "@/lib/superadmin/auth";
import { loadSuperadminUsers } from "@/lib/superadmin/data";
import { computeCockpit } from "@/lib/superadmin/metrics";
import { BETA_END_DATE_LABEL, betaDaysRemaining, isBetaActive } from "@/lib/beta";
import { PLAN_PRICES, euro, type PaidPlanId } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const REMINDER_LABELS: Record<string, string> = { start: "Başla", start2: "Başla (2.)", comeback: "Geri dön" };

export default async function SuperAdminKokpit() {
  const admin = adminClient();
  const [users, { count: companies }, { data: subs }] = await Promise.all([
    loadSuperadminUsers(admin),
    admin.from("companies").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan, status"),
  ]);
  const c = computeCockpit(users, new Date());

  const paying = (subs ?? []).filter((s) => s.status === "active");
  const mrr = paying.reduce((sum, s) => sum + (PLAN_PRICES[s.plan as PaidPlanId]?.monthly ?? 0), 0);
  const beta = isBetaActive();
  const maxDaily = Math.max(1, ...c.daily.map((d) => Math.max(d.signups, d.active)));

  const kpis: { v: string | number; l: string; h?: string; href?: string; color?: string }[] = [
    { v: c.total, l: "Kullanıcı", h: `${companies ?? 0} firma`, href: "/superadmin/users" },
    { v: c.signups7, l: "Yeni kayıt · 7 gün", h: `bugün ${c.signupsToday} · 30 gün ${c.signups30}`, color: "var(--accent2)" },
    { v: c.active7, l: "Aktif · 7 gün", h: `30 gün: ${c.active30}`, href: "/superadmin/users?seg=active7", color: "var(--green)" },
    { v: `%${c.activationRate}`, l: "Aktivasyon", h: `${c.activated} kişi en az 1 kayıt girdi`, color: c.activationRate >= 50 ? "var(--green)" : "var(--orange)" },
    { v: c.neverUsed, l: "Hiç kullanmamış", h: "2+ gün önce kayıt, 0 kayıt", href: "/superadmin/users?seg=never", color: "var(--orange)" },
    { v: c.inactive14, l: "Pasif 14+ gün", h: "önce kullandı, sonra bıraktı", href: "/superadmin/users?seg=inactive", color: "var(--red)" },
    { v: c.unconfirmed, l: "E-posta onaysız", href: "/superadmin/users?seg=unconfirmed" },
    { v: c.pendingDeletion, l: "Bekleyen silme talebi", h: "DSGVO, 30 gün sonra", href: "/superadmin/users?seg=deletion" },
  ];

  return (
    <div>
      <h1 className="sa-title">Kokpit</h1>
      <p className="sa-sub">
        {beta
          ? <>Beta aktif · {BETA_END_DATE_LABEL} tarihine <strong style={{ color: "var(--text)" }}>{betaDaysRemaining()} gün</strong> kaldı</>
          : "Genel bakış"}
      </p>

      <div className="sa-grid">
        {kpis.map((k) => {
          const inner = (
            <>
              <div className="v" style={{ color: k.color ?? "var(--text)" }}>{k.v}</div>
              <div className="l">{k.l}</div>
              {k.h && <div className="h">{k.h}</div>}
            </>
          );
          return k.href
            ? <Link key={k.l} href={k.href} className="card sa-kpi">{inner}</Link>
            : <div key={k.l} className="card sa-kpi">{inner}</div>;
        })}
      </div>

      <h2 className="sa-section">Son 30 gün</h2>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--accent2)", marginRight: 6 }} />Yeni kayıt</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--green)", marginRight: 6 }} />Kayıt giren kişi</span>
        </div>
        <div role="img" aria-label="Son 30 günün yeni kayıt ve aktif kullanıcı grafiği" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
          {c.daily.map((d) => (
            <div key={d.date} title={`${d.date.slice(8, 10)}.${d.date.slice(5, 7)} · ${d.signups} kayıt · ${d.active} aktif`}
              style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 1, height: "100%" }}>
              <div style={{ flex: 1, height: `${(d.signups / maxDaily) * 100}%`, minHeight: d.signups ? 3 : 0, background: "var(--accent2)", borderRadius: "3px 3px 0 0" }} />
              <div style={{ flex: 1, height: `${(d.active / maxDaily) * 100}%`, minHeight: d.active ? 3 : 0, background: "var(--green)", borderRadius: "3px 3px 0 0" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          <span>{c.daily[0]!.date.slice(8, 10)}.{c.daily[0]!.date.slice(5, 7)}.</span>
          <span>bugün</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Nereden geldiler?</h3>
          {c.sources.map((s) => (
            <div key={s.key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{s.label}</span><strong>{s.count}</strong>
              </div>
              <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, marginTop: 3 }}>
                <div style={{ height: "100%", width: `${(s.count / Math.max(1, c.total)) * 100}%`, background: s.key === "none" ? "var(--muted)" : "var(--accent2)", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>En çok davet getirenler</h3>
          {c.topReferrers.length === 0
            ? <p className="sa-muted" style={{ fontSize: 13 }}>Henüz davet linkiyle gelen yok.</p>
            : c.topReferrers.map((r) => (
              <div key={r.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{r.name}</span><strong>{r.count}</strong>
              </div>
            ))}

          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "18px 0 10px" }}>Hatırlatma mailleri · 7 gün</h3>
          {Object.keys(c.reminders7).length === 0
            ? <p className="sa-muted" style={{ fontSize: 13 }}>Son 7 günde hatırlatma gönderilmedi.</p>
            : Object.entries(c.reminders7).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>{REMINDER_LABELS[k] ?? k}</span><strong>{v}</strong>
              </div>
            ))}
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Gelir</h3>
          {beta && paying.length === 0 ? (
            <p className="sa-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Beta boyunca ödeme yok. {BETA_END_DATE_LABEL} sonrası burada MRR / ARR görünecek
              (beta kullanıcıları %50 indirimli).
            </p>
          ) : (
            <>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 800, color: "var(--green)" }}>{euro(mrr)}</div>
              <div className="sa-muted" style={{ fontSize: 12 }}>MRR · {paying.length} aktif abonelik · ARR {euro(mrr * 12)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
