import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { SupportButton } from "@/components/ui/SupportButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workly – Arbeitszeiterfassung",
  description: "Smart Work & Time Tracking Platform",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0f13",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
          <SupportButton />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
