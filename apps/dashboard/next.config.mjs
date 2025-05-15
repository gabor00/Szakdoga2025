//@ts-check
import { composePlugins, withNx } from "@nx/next";

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  // Add any custom Next.js config here
  reactStrictMode: true,
  transpilePackages: ["@nx/react"],
  images: {
    unoptimized: true,
  },
  output: 'standalone',
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
