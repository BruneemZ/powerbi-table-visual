const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: {
        'visual': './src/visual.ts'
    },
    devtool: 'source-map',
    mode: 'development',
    optimization: {
        concatenateModules: false,
        minimize: false
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: false,
                            compilerOptions: {
                                declaration: false
                            }
                        }
                    }
                ],
                exclude: /node_modules/
            },
            {
                test: /\.less$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                paths: [path.resolve(__dirname, 'node_modules')]
                            }
                        }
                    }
                ]
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.css']
    },
    output: {
        path: path.resolve(__dirname, '.tmp', 'drop'),
        publicPath: '/assets',
        filename: '[name].js'
    },
    externals: {
        'powerbi-visuals-api': '{}'
    }
};
