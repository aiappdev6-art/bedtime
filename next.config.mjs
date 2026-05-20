/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // The PDF renderer (lib/pdf.tsx) loads Noto Sans Arabic from public/fonts at
  // runtime. Vercel's file-tracer doesn't see the dynamic `path.join` reference
  // so we have to include the file explicitly in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/story/**": ["./public/fonts/**"],
  },
};

export default nextConfig;
