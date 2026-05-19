import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import GeneratingRunner from "./GeneratingRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GeneratingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/story/generating?orderId=${orderId}`);

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, story_id, options")
    .eq("id", orderId)
    .single();

  if (error || !order || order.user_id !== user.id) notFound();

  // If generation already completed, go straight to the story.
  if (order.story_id) redirect(`/story/${order.story_id}`);

  // If not paid, send them back to checkout.
  if (order.status !== "paid") {
    redirect(`/story/checkout?orderId=${order.id}`);
  }

  return <GeneratingRunner orderId={order.id} />;
}
