/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typedRoutes: false,
  allowedDevOrigins: [
    '192.168.50.34',
    'thread-difference-strike-waters.trycloudflare.com'
  ]
};

export default nextConfig;
