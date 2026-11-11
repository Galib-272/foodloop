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
  webpack: (config, { isServer }) => {
    // OCR (tesseract.js) only ever runs in the donor's browser; keep its Node build out of the server bundle.
    if (isServer) config.resolve.alias = { ...config.resolve.alias, 'tesseract.js': false };
    return config;
  },
};

module.exports = nextConfig;
