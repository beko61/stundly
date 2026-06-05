import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Herkesin erişebileceği rotalar (giriş gerektirmez)
const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/", "/pricing", "/impressum", "/datenschutz", "/setup"];

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    return NextResponse.redirect(new URL("/tracker", request.url));
  }

  // Rol koruması — giriş yapmışsa profile'ı çek
  if (user) {
    const isCompanyPath = COMPANY_ADMIN_PATHS.some((p) => pathname.startsWith(p));
    const isSuperAdminPath = SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p));

    if (isCompanyPath || isSuperAdminPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role ?? "individual";

      if (isSuperAdminPath && role !== "super_admin") {
        return NextResponse.redirect(new URL("/tracker", request.url));
      }

      if (isCompanyPath && role !== "company_admin" && role !== "super_admin") {
        return NextResponse.redirect(new URL("/tracker", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
