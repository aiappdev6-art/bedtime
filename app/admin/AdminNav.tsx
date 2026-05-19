"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminNav({ email }: { email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const link = (href: string, label: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
          active
            ? "bg-slate-800 text-white"
            : "text-slate-600 hover:bg-slate-200"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 mr-4">Admin</span>
          {link("/admin", "Dashboard")}
          {link("/admin/stories", "Stories")}
          {link("/admin/orders", "Orders")}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{email}</span>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
