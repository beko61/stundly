import { redirect } from "next/navigation";

/**
 * `/team` sayfası v0.33.0'da kaldırıldı — `/company/employees` ile 100% duplicate'ti
 * (invite + liste). Bookmark/deep-link uyumluluğu için kalıcı redirect.
 */
export default function TeamRedirect() {
  redirect("/company/employees");
}
