-- 031_reminder_emails.sql
-- Erinnerungs-Mails für Nutzer, die Stundly nach der Registrierung nicht (mehr) nutzen.
-- Cron /api/cron/reminders (täglich). Default: an — abbestellbar per Link in jeder Mail
-- und in den Einstellungen.

alter table public.profiles
  add column if not exists reminder_emails_enabled boolean default true,
  add column if not exists reminder_last_type      text,
  add column if not exists reminder_last_sent_at   timestamptz;

comment on column public.profiles.reminder_emails_enabled is
  'Erinnerungs-Mails (start / start2 / comeback). Default true, abbestellbar.';
comment on column public.profiles.reminder_last_type is
  'Zuletzt gesendete Erinnerung: start | start2 | comeback';
comment on column public.profiles.reminder_last_sent_at is
  'Zeitpunkt der letzten Erinnerungs-Mail';

select 'Migration 031 erfolgreich: reminder_emails_enabled, reminder_last_type, reminder_last_sent_at' as result;
