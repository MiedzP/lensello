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

  typedRoutes: true,
};

export default nextConfig;
