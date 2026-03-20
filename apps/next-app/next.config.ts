/** @type {import('next').NextConfig} */
const repo = 'autograph'

module.exports = {
  output: 'export',
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  images: {
    unoptimized: true,
  },
}