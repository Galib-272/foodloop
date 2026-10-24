/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    // Native database driver used on Vercel: keep it as a normal Node require so it is traced into the server bundle.
    serverComponentsExternalPackages: ['libsql'],
  },
};

module.exports = nextConfig;
