const config = require("./webpack.config");

module.exports = {
  ...config,
  mode: "development",
  devServer: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
};
