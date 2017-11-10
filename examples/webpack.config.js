module.exports = {
  entry: __dirname + '/index.js',
  output: {
    path: __dirname,
    filename: 'dist.js',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "env"
            ],
          },
        },
      },
    ],
  },
}