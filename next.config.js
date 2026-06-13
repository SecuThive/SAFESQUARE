/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 디자인 자동 생성 등 장시간 실행 작업을 위해 프록시 타임아웃 10분으로 확장
  experimental: {
    proxyTimeout: 660_000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
