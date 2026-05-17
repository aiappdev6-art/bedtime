import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Login page renders its own layout (no nav, no auth wall).
  // Middleware already gates everything else, but we still need user.email here.
  if (!user) {
    // Should not happen for non-login routes because middleware redirects.
    // But if it does, render children plain (login page handles itself).
    return <>{children}</>;
  }

  if (process.env.ADMIN_EMAIL && user.email !== process.env.ADMIN_EMAIL) {
    redirect("/admin/login?error=not-admin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav email={user.email ?? ""} />
      <div className="max-w-7xl mx-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
