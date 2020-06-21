const path = require('path');

module.exports = {
  entry: './src/options.tsx',
  output: {
    filename: 'options.js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: './',
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {enforce: 'pre', test: /\.js$/, loader: 'source-map-loader'},
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {loader: 'css-loader', options: {url: false}},
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {},
          },
        ],
      },
    ],
  },
};
