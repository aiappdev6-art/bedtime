// Server-side PDF rendering for stories. Used by /api/story/[id]/pdf.
//
// Notes:
//  - @react-pdf/renderer's <Image src=...> accepts http URLs and data: URIs.
//    Our stories.pages[].imageUrl is usually a base64 data: URI (server-fetched
//    and inlined by the image providers) but can also be a remote URL (picsum
//    fallback). Both work.
//  - Page size: A5 landscape gives a nice picture-book aspect ratio.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { Story } from "@/lib/types";

const APP_NAME = "Kid's Story Maker";

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
  return (
    <Document title={story.title} author={APP_NAME}>
      {/* Cover */}
      <Page size="A5" orientation="landscape" style={styles.cover}>
        <Text style={styles.coverTitle}>{story.title}</Text>
        {story.pages[0]?.imageUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={story.pages[0].imageUrl} style={styles.coverImage} />
        )}
        <Text style={styles.coverFooter}>{APP_NAME}</Text>
      </Page>

      {/* One page per story page */}
      {story.pages.map((p, i) => (
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
          <Text style={styles.pageText}>{p.text}</Text>
          <View style={styles.footer} fixed>
            <Text>{APP_NAME}</Text>
            <Text>
              Page {i + 1} / {story.pages.length}
            </Text>
          </View>
        </Page>
      ))}
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
