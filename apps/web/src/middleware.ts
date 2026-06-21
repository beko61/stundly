import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Herkesin erişebileceği rotalar (giriş gerektirmez)
const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/", "/pricing", "/impressum", "/datenschutz", "/agb"];

// Sadece company_admin veya super_admin erişebilir
const COMPANY_ADMIN_PATHS = ["/company", "/team"];

// Sadece super_admin erişebilir
const SUPER_ADMIN_PATHS = ["/superadmin"];

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
  const isLoginOrRegister = pathname === "/login" || pathname === "/register";

  // Giriş yapmamış → public değilse login'e yönlendir
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    // Giriş yapmış + login/register'a giderse → /dashboard (rol bazlı yönlendirme login sayfası kendi yapıyor)
    if (isLoginOrRegister) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Gate sadece protected path'lerde — public path'lerde gate yapma (loop + perf riski).
    const isCompanyPath = COMPANY_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    const needsCheck = !isPublic;

    if (needsCheck) {
      // Profile fetch — fail olursa middleware'i engelleme (fail-open).
      let profile: { role?: string; is_active?: boolean; deleted_at?: string | null } | null = null;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("role, is_active, deleted_at")
          .eq("user_id", user.id)
          .single();
        profile = data;
      } catch {
        // Profile lookup fail — fail-open: kullanıcı engellenmesin
      }

      // Soft-delete / deaktiviert gate — sadece profile gerçekten gelmişse
      if (profile && (profile.deleted_at || profile.is_active === false)) {
        await supabase.auth.signOut();
        const url = new URL("/login", request.url);
        url.searchParams.set("blocked", profile.deleted_at ? "deleted" : "inactive");
        return NextResponse.redirect(url);
      }

      // Role check sadece company/superadmin path'lerinde
      if (isSuperAdminPath || isCompanyPath) {
        const role = profile?.role ?? "individual";
        if (isSuperAdminPath && role !== "super_admin") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        if (isCompanyPath && role !== "company_admin" && role !== "super_admin") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
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
