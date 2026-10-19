/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '30mb', // Cho phép upload file tối đa 30MB
    },
  },
};

module.exports = nextConfig;