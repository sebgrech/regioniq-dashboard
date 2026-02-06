/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.logo.dev',
      },
    ],
  },
  // Environment variable defaults - can be overridden in Vercel/production
  env: {
    // Use Vercel's edge CDN for GeoJSON files instead of external R2 CDN
    // This improves LAD choropleth loading performance in production
    NEXT_PUBLIC_USE_CDN: process.env.NEXT_PUBLIC_USE_CDN ?? "false",
  },
  async headers() {
    return [
      {
        // Aggressive caching for boundary files — they change maybe once a decade
        source: '/boundaries/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
