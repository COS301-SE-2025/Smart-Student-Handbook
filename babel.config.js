// babel.config.js
module.exports = {
    presets: [
      'next/babel',
      ['@babel/preset-env', {
        targets: {
          node: 'current',
        },
      }],
      ['@babel/preset-react', {
        runtime: 'automatic',
      }],
      ['@babel/preset-typescript', {
        allowDeclareFields: true,
      }],
    ],
    env: {
      test: {
        presets: [
          ['next/babel'],
          ['@babel/preset-env', {
            targets: {
              node: 'current',
            },
          }],
          ['@babel/preset-react', {
            runtime: 'automatic',
          }],
          ['@babel/preset-typescript', {
            allowDeclareFields: true,
          }],
        ],
      },
    },
  }