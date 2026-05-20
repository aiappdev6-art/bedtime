// Server-side PDF rendering for stories. Used by /api/story/[id]/pdf.
//
// Notes:
//  - @react-pdf/renderer's <Image src=...> accepts http URLs and data: URIs.
//    Our stories.pages[].imageUrl is usually a base64 data: URI (server-fetched
//    and inlined by the image providers) but can also be a remote URL (picsum
//    fallback). Both work.
//  - Page size: A5 landscape gives a nice picture-book aspect ratio.
//  - Arabic support: the default Helvetica font has no Arabic glyphs, so we
//    register Noto Sans Arabic (variable, both weights). The file lives in
//    public/fonts and is bundled into the serverless function by
//    outputFileTracingIncludes in next.config.mjs.

import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { Story } from "@/lib/types";

const APP_NAME = "Kid's Story Maker";

// Register once at module load. The same variable font file covers both
// regular and bold weights — fontkit selects the right axis instance.
const ARABIC_FONT_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "NotoSansArabic-Regular.ttf",
);

Font.register({
  family: "NotoArabic",
  fonts: [
    { src: ARABIC_FONT_PATH, fontWeight: 400 },
    { src: ARABIC_FONT_PATH, fontWeight: 700 },
  ],
});

// Disable @react-pdf's hyphenation for Arabic — splitting words breaks
// shaping and produces ugly mid-word breaks.
Font.registerHyphenationCallback((word: string) => [word]);

// Any character in the Arabic / Arabic Supplement / Arabic Extended ranges
// marks the run as RTL. Good enough for our title/page text use cases —
// we don't try to mix LTR and RTL inside a single paragraph.
const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

function isRtl(text: string | null | undefined): boolean {
  if (!text) return false;
  return ARABIC_RANGE.test(text);
}

const styles = StyleSheet.create({
  cover: {
    flexDirection: "column",
    backgroundColor: "#FFFBEB", // amber-50
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: 700,
    color: "#B45309", // amber-700
    textAlign: "center",
    marginBottom: 24,
  },
  coverImage: {
    width: "80%",
    height: 320,
    objectFit: "cover",
    borderRadius: 12,
  },
  coverFooter: {
    marginTop: 32,
    fontSize: 12,
    color: "#92400E", // amber-800
  },

  storyPage: {
    flexDirection: "column",
    padding: 32,
    backgroundColor: "#FFFFFF",
  },
  pageImage: {
    width: "100%",
    height: 320,
    objectFit: "cover",
    borderRadius: 8,
    marginBottom: 20,
  },
  pageText: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "#1F2937", // gray-800
    textAlign: "left",
  },
  pageTextRtl: {
    fontFamily: "NotoArabic",
    textAlign: "right",
  },
  coverTitleRtl: {
    fontFamily: "NotoArabic",
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 9,
    color: "#9CA3AF", // gray-400
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function StoryDocument({ story }: { story: Story }) {
  const titleRtl = isRtl(story.title);

  return (
    <Document title={story.title} author={APP_NAME}>
      {/* Cover */}
      <Page size="A5" orientation="landscape" style={styles.cover}>
        <Text
          style={titleRtl ? [styles.coverTitle, styles.coverTitleRtl] : styles.coverTitle}
        >
          {story.title}
        </Text>
        {story.pages[0]?.imageUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={story.pages[0].imageUrl} style={styles.coverImage} />
        )}
        <Text style={styles.coverFooter}>{APP_NAME}</Text>
      </Page>

      {/* One page per story page */}
      {story.pages.map((p, i) => {
        const pageRtl = isRtl(p.text);
        return (
          <Page
            key={i}
            size="A5"
            orientation="landscape"
            style={styles.storyPage}
          >
            {p.imageUrl && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={p.imageUrl} style={styles.pageImage} />
            )}
            <Text
              style={pageRtl ? [styles.pageText, styles.pageTextRtl] : styles.pageText}
            >
              {p.text}
            </Text>
            <View style={styles.footer} fixed>
              <Text>{APP_NAME}</Text>
              <Text>
                Page {i + 1} / {story.pages.length}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

/** Render the story to a PDF buffer. */
export async function renderStoryPdf(story: Story): Promise<Buffer> {
  const instance = pdf(<StoryDocument story={story} />);
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
