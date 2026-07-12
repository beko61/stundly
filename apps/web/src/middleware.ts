import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Herkesin erişebileceği rotalar (giriş gerektirmez)
const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/", "/pricing", "/impressum", "/datenschutz", "/agb", "/avv", "/demo", "/kontakt", "/handwerker", "/notdienst-verwaltung", "/vergleich", "/api/contact", "/api/cron"];

// Sadece company_admin veya super_admin erişebilir
const COMPANY_ADMIN_PATHS = ["/company", "/team"];

// Sadece super_admin erişebilir
const SUPER_ADMIN_PATHS = ["/superadmin"];

// Migration 028 custom_access_token_hook JWT'ye `user_role` claim ekler.
// JWT payload zaten getUser() ile validate edildikten sonra decode edip
// role okuyoruz — ekstra DB round-trip yok.
function readUserRoleFromJwt(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as { user_role?: string };
    return typeof parsed.user_role === "string" ? parsed.user_role : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: unknown }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Cookie options type from @supabase/ssr; cast to Next's ResponseCookie partial.
            // eslint-disable-next-line
            response.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Giriş yapmamış → public değilse login'e yönlendir
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Giriş yapmış → login/register'a gitmeye çalışırsa yönlendir
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Rol koruması — sadece company / superadmin path'lerinde çalışır.
  // (Soft-delete gate layout'larda + login sayfasında yapılıyor.)
  if (user) {
    const isCompanyPath    = COMPANY_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));

    if (isCompanyPath || isSuperAdminPath) {
      // Önce JWT claim'den oku (migration 028 hook). getSession() cookies'den
      // okur, network yok. Hook aktif değilse veya legacy session ise claim
      // null gelir — profiles fallback kalır (davranış eskisi gibi).
      let role: string | null = null;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        role = readUserRoleFromJwt(session.access_token);
      }

      if (role === null) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        role = profile?.role ?? "individual";
      }

      if (isSuperAdminPath && role !== "super_admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (isCompanyPath && role !== "company_admin" && role !== "super_admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Static + metadata route'ları auth middleware'inden hariç tut
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|robots.txt|sitemap.xml|opengraph-image|twitter-image|apple-icon|icon).*)",
  ],
};
