"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthChip() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setPhone(data.user?.phone ?? null);
    });
  }, []);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!phone) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-mono">
        +{phone}
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
