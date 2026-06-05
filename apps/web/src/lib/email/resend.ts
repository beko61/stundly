import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY ?? "");

const FROM = "Workly <noreply@workly.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Einladung zu ${companyName} auf Workly`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">WORKLY</div>

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

// Hoşgeldin maili (kayıt sonrası)
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

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Willkommen bei Workly!",
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">WORKLY</div>

        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 12px;">Willkommen, ${name}! 👋</h1>
        <p style="color: #6b6b80; font-size: 14px; line-height: 1.7; margin-bottom: 24px;">
          Ihr Konto ist jetzt aktiv. Sie haben <strong style="color: #c084fc;">14 Tage kostenlos</strong> Zugang zu allen Funktionen.
        </p>

        ${isCompany ? `
        <div style="background: #18181f; border: 1px solid #2e2e3d; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <p style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">Nächste Schritte für Ihr Unternehmen:</p>
          <ul style="color: #6b6b80; font-size: 13px; line-height: 2; padding-left: 16px;">
            <li>Mitarbeiter ins Admin-Panel einladen</li>
            <li>Arbeitszeitregeln konfigurieren</li>
            <li>Mobile App herunterladen</li>
          </ul>
        </div>
        ` : ""}

        <a href="${APP_URL}/tracker" style="display: inline-block; background: #7c6af7; color: #fff; padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 15px;">
          Jetzt loslegen →
        </a>

        <p style="color: #6b6b80; font-size: 11px; margin-top: 32px; border-top: 1px solid #2e2e3d; padding-top: 16px;">
          Workly · DSGVO-konform · Daten in Deutschland (EU) ·
          <a href="${APP_URL}/datenschutz" style="color: #c084fc;">Datenschutz</a> ·
          <a href="${APP_URL}/impressum" style="color: #c084fc;">Impressum</a>
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
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Ihr Workly ${planName}-Abonnement ist aktiv`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; background: #0f0f13; color: #e8e8f0; padding: 40px 32px; border-radius: 16px;">
        <div style="color: #c084fc; font-weight: 800; font-size: 18px; letter-spacing: 3px; margin-bottom: 32px;">WORKLY</div>

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
