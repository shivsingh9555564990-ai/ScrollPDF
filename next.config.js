const nextConfig = {
  output: "export",      // ⭐ important (static mode)
  images: {
    unoptimized: true,    // Next Image issue fix
  },
  trailingSlash: true,
};

module.exports = nextConfig;
