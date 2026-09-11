/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@apiproof/core", "@apiproof/providers", "@apiproof/shared"]
};

export default nextConfig;
