import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { StoryPage } from "@/lib/types";
import ModerationActions from "./ModerationActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  device_id: string;
  title: string;
  description: string | null;
  pages: StoryPage[];
  created_at: string;
  flagged_at: string | null;
  flagged_reason: string | null;
  deleted_at: string | null;
};

export default async function AdminStoryDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("stories")
    .select(
      "id, device_id, title, description, pages, created_at, flagged_at, flagged_reason, deleted_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  const story = data as Row;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/stories"
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back to stories
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{story.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {new Date(story.created_at).toLocaleString()} ·{" "}
              <span className="font-mono">{story.device_id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {story.deleted_at && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                deleted
              </span>
            )}
            {story.flagged_at && (
              <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                flagged
              </span>
            )}
            {!story.deleted_at && (
              <Link
                href={`/story/${story.id}`}
                target="_blank"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                View public ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Metadata</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Meta label="Description">{story.description || "—"}</Meta>
          <Meta label="Device ID">
            <code className="text-xs">{story.device_id}</code>
          </Meta>
          {story.flagged_at && (
            <Meta label="Flagged at">
              {new Date(story.flagged_at).toLocaleString()}
            </Meta>
          )}
          {story.flagged_reason && (
            <Meta label="Flag reason">{story.flagged_reason}</Meta>
          )}
          {story.deleted_at && (
            <Meta label="Deleted at">
              {new Date(story.deleted_at).toLocaleString()}
            </Meta>
          )}
        </dl>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Moderation</h2>
        <ModerationActions
          id={story.id}
          flagged={!!story.flagged_at}
          deleted={!!story.deleted_at}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-slate-800">Pages</h2>
        {story.pages.map((p, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2"
          >
            <div className="bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt={`Page ${i + 1}`}
                className="w-full h-full object-cover aspect-[4/3]"
              />
            </div>
            <div className="p-5 space-y-3">
              <div className="text-xs uppercase font-semibold text-slate-500">
                Page {i + 1}
              </div>
              <p className="text-slate-800">{p.text}</p>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  Image prompt
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 font-mono">
                  {p.imagePrompt}
                </p>
              </div>
              {p.audioUrl && (
                <audio src={p.audioUrl} controls className="w-full" />
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-800 mt-0.5">{children}</dd>
    </div>
  );
}
