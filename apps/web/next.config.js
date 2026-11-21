/* global process */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDirectory, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep tracing inside this repository when a parent directory contains an
  // unrelated lockfile. This is required for deterministic local builds and
  // prevents Next from walking user-level temporary directories.
  outputFileTracingRoot: workspaceRoot,
  // Windows can return EPERM when multiple Next build workers create the
  // same nested App Router output directory concurrently. Use one isolated
  // worker on Windows for every production build; Linux/Vercel keeps the
  // normal Next defaults.
  experimental: process.platform === 'win32'
    ? {
        cpus: 1,
        workerThreads: false,
        memoryBasedWorkersCount: false,
        // The custom extension-alias hook disables Next's implicit worker.
        // Re-enable it on Windows so route output is serialized through the
        // worker instead of racing on the shared server/app tree.
        webpackBuildWorker: process.platform === 'win32',
      }
    : undefined,
  // Keep release verification isolated from stale or locked local .next output.
  // Production retains Next.js' normal .next directory unless explicitly
  // overridden by the build environment.
  // Windows release builds use an isolated directory because Next can hit
  // EPERM while recreating nested App Router output under an existing .next
  // tree. Vercel/Linux keeps the conventional .next directory.
  distDir: process.env.NEXT_DIST_DIR?.trim() || (process.platform === 'win32' ? '.next-release' : '.next'),
  serverExternalPackages: [
    "pg",
    "ts-morph",
    "@apiproof/core",
    "@apiproof/providers",
    "@apiproof/shared",
    "@apiproof/analyzers"
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
};

export default nextConfig;
