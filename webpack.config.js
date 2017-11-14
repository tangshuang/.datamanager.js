module.exports = {
  entry: __dirname + '/datamanager.js',
  output: {
    path: __dirname + '/dist',
    filename: 'datamanager.js',
    library: 'DataManager',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env']
          },
        },
      },
    ],
  },
  externals: [require('webpack-node-externals')()],
}