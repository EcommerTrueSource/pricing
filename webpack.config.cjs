const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'src/modules/contract-management/template/templates',
          to: 'src/modules/contract-management/template/templates',
        },
      ],
    }),
  ],
};
