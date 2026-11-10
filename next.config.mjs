/**
 * The app is fully client-side, so it is exported as static files.
 * NEXT_PUBLIC_BASE_PATH is set when deploying to a sub-path such as
 * GitHub Pages (https://<user>.github.io/CineView3D); empty locally.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
