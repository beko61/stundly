import { Resend } from "resend";

const FROM = "Stundly <noreply@stundly.de>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY ist nicht konfiguriert");
    }
    _resend = new Resend(key);
  }
  return _resend;
}
export const resend = { get emails() { return getResend().emails; } };

// Çalışan davet maili
export async function sendInvitationEmail({
  to,
  companyName,
  inviterName,
  token,
  role,
}: {
  to: string;
  companyName: string;
  inviterName: string;
  token: string;
  role: string;
}) {
  const inviteUrl = `${APP_URL}/join/${token}`;
  const roleLabel = role === "company_admin" ? "Administrator" : "Mitarbeiter";

  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Einladung zu ${companyName} auf Stundly`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">STUNDLY</div>

        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">
          Sie wurden eingeladen 🎉
        </h1>
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          <strong style="color: #e8e8f0;">${inviterName}</strong> hat Sie eingeladen, dem Unternehmen
          <strong style="color: #e8e8f0;"> ${companyName}</strong> als <strong style="color: #e8e8f0;">${roleLabel}</strong> beizutreten.
        </p>

        <a href="${inviteUrl}" style="display: inline-block; background: #7c6af7; color: #fff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px; margin-bottom: 24px;">
          Einladung annehmen
        </a>

        <p style="color: #6b6b80; font-size: 12px; margin-top: 24px; border-top: 1px solid #2e2e3d; padding-top: 16px;">
          Dieser Link ist 7 Tage gültig. Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.<br/>
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a> ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a>
        </p>
      </div>
    `,
  });
}

// Hoşgeldin maili (kayıt sonrası) — Beta-Phase Variant
export async function sendWelcomeEmail({
  to,
  name,
  plan,
}: {
  to: string;
  name: string;
  plan: "individual" | "company";
}) {
  const isCompany = plan === "company";
  const { BETA_MODE, BETA_END_DATE_LABEL, betaDaysRemaining } = await import("../beta");
  const isBeta = BETA_MODE;
  const daysLeft = betaDaysRemaining();

  return getResend().emails.send({
    from: FROM,
    to,
    subject: isBeta
      ? "🎁 Willkommen bei Stundly – 3 Monate komplett kostenlos!"
      : "Willkommen bei Stundly!",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">STUNDLY</div>

        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">Willkommen, ${name}! 👋</h1>

        ${isBeta ? `
        <div style="background: linear-gradient(135deg, rgba(124,106,247,0.18), rgba(192,132,252,0.18)); border: 1px solid rgba(192,132,252,0.4); border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
          <p style="font-size: 13px; font-weight: 800; color: #c084fc; letter-spacing: 1px; margin: 0 0 8px;">🎁 BETA-TESTER</p>
          <p style="color: #e8e8f0; font-size: 14px; line-height: 1.7; margin: 0;">
            Du bekommst <strong>alle Funktionen 3 Monate komplett kostenlos</strong> — bis zum
            <strong>${BETA_END_DATE_LABEL}</strong> (noch ${daysLeft} Tage).
            Keine Kreditkarte, keine versteckten Kosten.
          </p>
        </div>
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          Als Dankeschön für deinen Beta-Test bekommst du nach der Beta <strong style="color: #c084fc;">50% lebenslangen Rabatt</strong>
          auf den Plan deiner Wahl.
        </p>
        ` : `
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          Ihr Konto ist jetzt aktiv. Sie haben <strong style="color: #c084fc;">14 Tage kostenlos</strong> Zugang zu allen Funktionen.
        </p>
        `}

        ${isCompany ? `
        <div style="background: #18181f; border: 1px solid #2e2e3d; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <p style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">Nächste Schritte für dein Unternehmen:</p>
          <ul style="color: #6b6b80; font-size: 13px; line-height: 2; padding-left: 16px;">
            <li>Mitarbeiter ins Admin-Panel einladen</li>
            <li>Arbeitszeitregeln konfigurieren</li>
            <li>Mobile App auf dem Handy installieren (PWA)</li>
          </ul>
        </div>
        ` : ""}

        <a href="${APP_URL}/dashboard" style="display: inline-block; background: #7c6af7; color: #fff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
          Zum Dashboard →
        </a>

        ${isBeta ? `
        <p style="color: #6b6b80; font-size: 12px; margin-top: 28px; line-height: 1.6;">
          💬 Du hast eine Idee oder einen Fehler gefunden? Antworte einfach auf diese Mail —
          ich freue mich über jedes Feedback.<br>
          <em>— Yusuf Bektas, Gründer</em>
        </p>
        ` : ""}

        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px;">
          Stundly · DSGVO-konform · Daten in Deutschland (EU) ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a> ·
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a>
        </p>
      </div>
    `,
  });
}

// Urlaubsantrag Entscheidung (Genehmigt/Abgelehnt) maili
export async function sendVacationDecisionEmail({
  to,
  employeeName,
  decision,
  startDate,
  endDate,
  daysCount,
  urlaubArt,
  rejectionReason,
  decidedByName,
}: {
  to: string;
  employeeName: string;
  decision: "approved" | "rejected";
  startDate: string;       // YYYY-MM-DD
  endDate:   string;
  daysCount: number;
  urlaubArt: string | null;
  rejectionReason?: string | null;
  decidedByName: string;
}) {
  const isApproved = decision === "approved";
  const accent     = isApproved ? "#34d399" : "#f87171";
  const title      = isApproved ? "Urlaubsantrag genehmigt" : "Urlaubsantrag abgelehnt";
  const emoji      = isApproved ? "✅" : "❌";
  const subject    = isApproved
    ? `Ihr Urlaubsantrag wurde genehmigt`
    : `Ihr Urlaubsantrag wurde abgelehnt`;

  function fmt(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  return getResend().emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">STUNDLY</div>

        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">${emoji} ${title}</h1>
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          Hallo ${employeeName}, Ihr Urlaubsantrag wurde von <strong style="color: #e8e8f0;">${decidedByName}</strong>
          ${isApproved ? "<strong style=\"color: #34d399;\">genehmigt</strong>" : "<strong style=\"color: #f87171;\">abgelehnt</strong>"}.
        </p>

        <div style="background: #18181f; border: 1px solid #2e2e3d; border-left: 3px solid ${accent}; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span style="color: #6b6b80;">Zeitraum</span>
            <span style="font-weight: 700;">${fmt(startDate)} – ${fmt(endDate)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span style="color: #6b6b80;">Arbeitstage</span>
            <span style="font-weight: 700;">${daysCount} Tage</span>
          </div>
          ${urlaubArt ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color: #6b6b80;">Urlaubsart</span>
            <span style="font-weight: 700;">${urlaubArt}</span>
          </div>
          ` : ""}
        </div>

        ${!isApproved && rejectionReason ? `
        <div style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #f87171; font-weight: 800; letter-spacing: 1px; margin: 0 0 6px;">BEGRÜNDUNG</p>
          <p style="font-size: 13px; color: #e8e8f0; line-height: 1.6; margin: 0;">${rejectionReason}</p>
        </div>
        ` : ""}

        <a href="${APP_URL}/vacation" style="display: inline-block; background: #7c6af7; color: #fff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
          Zu meinen Anträgen →
        </a>

        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px;">
          Stundly · DSGVO-konform · Daten in Deutschland (EU)
        </p>
      </div>
    `,
  });
}

// Abonelik başladı maili
export async function sendSubscriptionConfirmationEmail({
  to,
  name,
  planName,
  periodEnd,
  amount,
}: {
  to: string;
  name: string;
  planName: string;
  periodEnd: string;
  amount: string;
}) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `Ihr Stundly ${planName}-Abonnement ist aktiv`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">STUNDLY</div>

        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">✅ Abonnement aktiv</h1>
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          Hallo ${name}, Ihr <strong style="color: #e8e8f0;">${planName}</strong>-Abonnement ist jetzt aktiv.
        </p>

        <div style="background: #18181f; border: 1px solid #2e2e3d; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span style="color: #6b6b80;">Plan</span>
            <span style="font-weight: 700;">${planName}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span style="color: #6b6b80;">Betrag (netto)</span>
            <span style="font-weight: 700;">€${amount} / Monat</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color: #6b6b80;">Nächste Zahlung</span>
            <span style="font-weight: 700;">${periodEnd}</span>
          </div>
        </div>

        <p style="color: #6b6b80; font-size: 12px;">
          Rechnungen und Abonnementverwaltung finden Sie in Ihrem <a href="${APP_URL}/company/billing" style="color: #c084fc;">Abrechnungsbereich</a>.
        </p>
      </div>
    `,
  });
}
