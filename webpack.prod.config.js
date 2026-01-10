const config = require("./webpack.config");

module.exports = {
  ...config,
  mode: "production",
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};
