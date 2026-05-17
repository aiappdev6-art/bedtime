import { notFound } from "next/navigation";
import StoryViewer from "../StoryViewer";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Story, StoryPage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoryByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("stories")
    .select("title, pages, deleted_at")
    .eq("id", id)
    .single();

  if (error || !data || data.deleted_at) notFound();

  const story: Story = {
    title: data.title,
    pages: data.pages as StoryPage[],
  };

  return <StoryViewer initialStory={story} />;
}
