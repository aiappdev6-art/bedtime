import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kid's Story Maker",
  description: "Generate illustrated kid's stories from a title and description.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
