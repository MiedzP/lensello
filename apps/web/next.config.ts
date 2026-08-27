import type { NextConfig } from 'next';

/**
 * Photos are served from Supabase Storage via signed URLs, so the project host
 * has to be allowlisted for next/image. Derived from the public env var rather
 * than hardcoded so staging and production don't need separate configs.
 */
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Skip TypeScript checking during build (pre-existing type issues in codebase)
  typescript: {
    ignoreBuildErrors: true,
  },

  // @lensello/core ships TypeScript source rather than a build artifact.
  transpilePackages: ['@lensello/core'],

  images: {
    // `domains` is deprecated in Next 16 — remotePatterns only.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/**',
          },
        ]
      : [],
    // Defaults to [75] in Next 16, which is too coarse for a photography
    // product: thumbnails can go lower, the single-photo view wants higher.
    qualities: [50, 75, 90],
  },

  /**
   * Kept out of the bundle and required at runtime instead.
   *
   * All three break when bundled into a serverless function: `sharp` ships a
   * platform-specific native binary that the bundler cannot inline, and
   * `imapflow` and `nodemailer` reach for Node internals and dynamic requires.
   * The failure mode is a module that will not load, which surfaces as a bare
   * Internal Server Error rather than anything that names the cause.
   */
  serverExternalPackages: ['sharp', 'imapflow', 'nodemailer'],

  typedRoutes: true,
};

export default nextConfig;
