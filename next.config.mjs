/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typedRoutes: false,
  allowedDevOrigins: [
    'localhost',
    '*.trycloudflare.com',
  ]
};

export default nextConfig;
