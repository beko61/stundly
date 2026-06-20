import type { DayType } from "../constants/dayTypes";

export type { DayType };

// ============================================================
// SaaS — Rol & Plan tipleri
// ============================================================
export type UserRole = "super_admin" | "company_admin" | "employee" | "individual";
export type SubscriptionPlan = "trial" | "individual" | "team" | "business";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Company {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  country_code: string;       // "DE", "AT", "CH" ...
  bundesland: string;         // "BE", "BY", "NI" ...
  vat_id: string | null;      // USt-IdNr.
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  owner_id: string;
  max_employees: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  company_id: string | null;
  user_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  billing_email: string | null;
  billing_name: string | null;
  billing_address: BillingAddress | null;
  vat_number: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  postal_code: string;
  city: string;
  country: string;  // ISO 3166-1 alpha-2
}

export interface Invitation {
  id: string;
  company_id: string;
  invited_by: string | null;
  email: string;
  role: UserRole;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface PlanFeatures {
  plan: SubscriptionPlan;
  display_name_de: string;
  display_name_en: string;
  price_monthly_eur: number;
  price_yearly_eur: number;
  max_employees: number | null;
  max_storage_mb: number;
  has_company_admin: boolean;
  has_pdf_export: boolean;
  has_api_access: boolean;
  has_ai_features: boolean;
  has_custom_reports: boolean;
  has_priority_support: boolean;
}

// ============================================================
// Profile (genişletilmiş)
// ============================================================
export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  personal_nr: string | null;
  eintrittsdatum: string | null;
  abteilung: string | null;
  vorgesetzter: string | null;
  signature_data: string | null;
  hourly_rate: number;
  monthly_target_hours: number;
  company_id: string | null;
  company_name: string | null;
  logo_data: string | null;
  bundesland: string;
  role: UserRole;
  plan: SubscriptionPlan;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Mevcut tipler (değişmedi)
// ============================================================
export interface TimeEntry {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  break_minutes: number;
  day_type: DayType;
  is_night_shift: boolean;
  note: string | null;
  tags: string[];
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Steuerklasse = "I" | "II" | "III" | "IV" | "V" | "VI";
export type KirchensteuerRate = 0 | 0.08 | 0.09;
export type TaxMode = "auto" | "manual";

export interface SalarySettings {
  id: string;
  user_id: string;
  hourly_rate: number;
  overtime_rate_multiplier: number;
  night_shift_bonus: number;
  notdienst_bonus: number;
  monthly_target_hours: number;
  valid_from: string;

  /** Steuerklasse (default 'I'). Lohnsteuer-Berechnung'a göre değişir. */
  steuerklasse?: Steuerklasse;
  /** Kirchensteuer (0 = Keine, 0.08 = BW/BY, 0.09 = übrige Bundesländer). */
  kirchensteuer?: KirchensteuerRate;
  /** Kind im Haushalt — Pflegeversicherung farkı (1.7% mit, 2.35% ohne). */
  hat_kinder?: boolean;
  /** "auto" = gerçek vergi hesabı, "manual" = sabit % düşür. */
  tax_mode?: TaxMode;
  /** taxMode "manual" ise yüzde abzug (0-100). */
  manuell_abzug?: number;
  /** Jährlicher Urlaubsanspruch in Tagen (default 30). */
  urlaub_anspruch?: number;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type UrlaubArt =
  | "Erholungsurlaub"
  | "Sonderurlaub"
  | "Bildungsurlaub"
  | "Unbezahlter Urlaub"
  | "Elternzeit"
  | "Überstundenabbau";

export const URLAUB_ARTEN: readonly UrlaubArt[] = [
  "Erholungsurlaub",
  "Sonderurlaub",
  "Bildungsurlaub",
  "Unbezahlter Urlaub",
  "Elternzeit",
  "Überstundenabbau",
] as const;

export interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  signature_url: string | null;
  status: "pending" | "approved" | "rejected";
  pdf_url: string | null;
  email_sent_at: string | null;
  created_at: string;
  urlaub_art?: UrlaubArt | null;
  vertretung?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  date: string;
  title: string;
  description: string | null;
  created_at: string;
}

// ============================================================
// Computed / derived
// ============================================================
export interface MonthSummary {
  year: number;
  month: number; // 1-12
  total_hours: number;
  target_hours: number;
  overtime_hours: number;
  arbeiten_days: number;
  urlaub_days: number;
  krank_days: number;
  notdienst_days: number;
  feiertag_days: number;
  frei_days: number;
  estimated_salary: number;
}

export interface WorkCalculation {
  total_minutes: number;
  break_minutes: number;
  net_minutes: number;
  is_overnight: boolean;
}

// Super Admin istatistikleri
export interface SuperAdminStats {
  total_companies: number;
  total_users: number;
  active_subscriptions: number;
  mrr_eur: number;          // Monthly Recurring Revenue
  arr_eur: number;          // Annual Recurring Revenue
  trial_count: number;
  churn_rate: number;
}
