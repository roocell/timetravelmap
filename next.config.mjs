/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typedRoutes: false,
  allowedDevOrigins: [
    'localhost',
    '192.168.50.34',
    'roobie.roocell.com',
    'roobie.roocell.com:8080',
    '*.trycloudflare.com',
  ]
};

export default nextConfig;
