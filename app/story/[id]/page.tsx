import { notFound, redirect } from "next/navigation";
import StoryViewer from "../StoryViewer";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import type { Story, StoryPage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoryByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supa = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect(`/login?next=/story/${id}`);

  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("title, pages, deleted_at, user_id")
    .eq("id", id)
    .single();

  if (error || !data || data.deleted_at) notFound();
  // Allow access if owner or if legacy story with no user_id (pre-auth migration).
  if (data.user_id && data.user_id !== user.id) notFound();

  const story: Story = {
    title: data.title,
    pages: data.pages as StoryPage[],
  };

  return <StoryViewer initialStory={story} storyId={id} />;
}
