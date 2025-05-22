//@ts-check
import { composePlugins, withNx } from "@nx/next";

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    svgr: false,
  },
  reactStrictMode: true,
  transpilePackages: ["@nx/react"],
  images: {
    unoptimized: true,
  },
  output: 'standalone',
};

const plugins = [
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
