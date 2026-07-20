/** @type {import('next').NextConfig} */
const nextConfig = {
  // @napi-rs/canvas 를 서버 번들에서 외부 모듈로 처리
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas"],
  },
};

module.exports = nextConfig;
