"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Story } from "@/lib/types";

export default function StoryViewer({
  initialStory,
  storyId,
}: {
  initialStory?: Story;
  storyId?: string;
}) {
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(initialStory ?? null);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (initialStory) return;
    const raw = sessionStorage.getItem("story");
    if (!raw) {
      router.replace("/");
      return;
    }
    setStory(JSON.parse(raw));
  }, [router, initialStory]);

  // Stop everything when page changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, [page]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!story) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-amber-700 text-xl">Loading your story...</div>
      </main>
    );
  }

  const total = story.pages.length;
  const current = story.pages[page];
  const hasElevenAudio = !!current.audioUrl;
  // Show audio controls when voice was purchased (authoritative flag from the
  // story row), OR for legacy stories that don't have the flag but do have
  // audio per page. When the flag is set but a specific page's audioUrl is
  // null (ElevenLabs failed), the play handler falls back to browser TTS so
  // the customer still gets narration for the page they paid for.
  const narrationPurchased =
    story.voice === true || story.pages.some((p) => !!p.audioUrl);

  const next = () => {
    if (page < total - 1) {
      setDirection(1);
      setPage(page + 1);
    }
  };
  const prev = () => {
    if (page > 0) {
      setDirection(-1);
      setPage(page - 1);
    }
  };

  const play = () => {
    if (hasElevenAudio && audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.warn("audio play failed, falling back to browser TTS:", err);
        speakWithBrowser();
      });
      return;
    }
    speakWithBrowser();
  };

  const speakWithBrowser = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.warn("Browser TTS not supported");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="w-full max-w-4xl mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="text-amber-700 hover:underline font-semibold"
        >
          ← New Story
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-700 text-center flex-1">
          {story.title}
        </h1>
        <span className="text-amber-700 font-semibold w-24 text-right">
          {page + 1} / {total}
        </span>
      </header>

      <div className="relative w-full max-w-4xl aspect-[4/3] sm:aspect-[16/10]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80, rotateY: direction * 15 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: -direction * 80, rotateY: -direction * 15 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 bg-white rounded-3xl shadow-2xl border-4 border-amber-200 overflow-hidden grid grid-cols-1 md:grid-cols-2"
          >
            <motion.div
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative bg-amber-100 min-h-[200px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.imageUrl}
                alt={current.imagePrompt}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </motion.div>

            <div className="flex items-center justify-center p-6 sm:p-10">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="text-lg sm:text-2xl leading-relaxed text-gray-800 font-medium"
              >
                {current.text}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {hasElevenAudio && (
        <audio
          ref={audioRef}
          src={current.audioUrl ?? undefined}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {narrationPurchased && (
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={play}
            disabled={playing}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-semibold shadow transition"
            aria-label="Play narration"
          >
            <span aria-hidden>▶</span> Play
          </button>
          <button
            onClick={stop}
            disabled={!playing}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full font-semibold shadow transition"
            aria-label="Stop narration"
          >
            <span aria-hidden>■</span> Stop
          </button>
        </div>
      )}

      <div className="flex gap-4 mt-6">
        <button
          onClick={prev}
          disabled={page === 0}
          className="px-6 py-3 bg-white border-2 border-amber-300 rounded-xl font-semibold text-amber-700 disabled:opacity-40 hover:bg-amber-50 transition"
        >
          ← Previous
        </button>
        <button
          onClick={next}
          disabled={page === total - 1}
          className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl font-semibold disabled:opacity-40 hover:shadow-lg transition"
        >
          Next →
        </button>
      </div>

      <div className="flex gap-2 mt-6">
        {story.pages.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > page ? 1 : -1);
              setPage(i);
            }}
            className={`w-3 h-3 rounded-full transition ${
              i === page ? "bg-amber-500 w-8" : "bg-amber-200"
            }`}
            aria-label={`Go to page ${i + 1}`}
          />
        ))}
      </div>

      {storyId && (
        <a
          href={`/api/story/${storyId}/pdf`}
          className="mt-6 px-5 py-2.5 bg-white border-2 border-amber-300 text-amber-700 rounded-full font-semibold shadow hover:bg-amber-50 transition inline-flex items-center gap-2"
        >
          <span aria-hidden>⬇</span> Download PDF
        </a>
      )}
    </main>
  );
}
