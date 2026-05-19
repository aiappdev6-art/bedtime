"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthChip() {
  const router = useRouter();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      // Prefer email; fall back to phone if a phone-OTP user exists.
      const u = data.user;
      if (!u) return setLabel(null);
      setLabel(u.email ?? (u.phone ? `+${u.phone}` : null));
    });
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!label) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono max-w-[200px] truncate">
        {label}
      </span>
      <button
        onClick={signOut}
        className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        Sign out
      </button>
    </div>
  );
}
