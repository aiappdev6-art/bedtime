import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const path = req.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin");
  const isAdminLogin = path === "/admin/login";
  const isUserLogin = path === "/login";

  // Admin area: only ADMIN_EMAIL may proceed.
  if (isAdminPath) {
    if (!user && !isAdminLogin) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
    if (user && ADMIN_EMAIL && user.email !== ADMIN_EMAIL && !isAdminLogin) {
      await supabase.auth.signOut();
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("error", "not-admin");
      return NextResponse.redirect(loginUrl);
    }
    return res;
  }

  // End-user area: any authenticated user may proceed.
  if (!user && !isUserLogin) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  // Gate everything except: api routes, /login, static assets, favicon.
  // No paths in this app start with "api", "login", "_next/", or "favicon" other
  // than the intended ones, so this simple negative lookahead is safe.
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
