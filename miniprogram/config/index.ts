import { defineConfig } from '@tarojs/cli';
import { normalizeApiBaseUrl } from './env';
import packageJson from '../package.json';

export default defineConfig<'webpack5'>({
  projectName: 'ai-fullstack-miniprogram',
  designWidth: 375,
  deviceRatio: { 375: 2, 750: 1 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: {
    type: 'webpack5',
    // 避免开发者工具跨 WSL 读取依赖预打包分块时沿用失效的文件索引。
    prebundle: { enable: false },
  },
  plugins: ['@tarojs/plugin-platform-weapp'],
  cache: { enable: true },
  defineConstants: {
    __API_BASE_URL__: JSON.stringify(
      normalizeApiBaseUrl(process.env.TARO_APP_API_BASE_URL, process.env.NODE_ENV === 'production'),
    ),
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  copy: {
    options: {},
    patterns: [
      { from: 'src/theme.generated.json', to: 'dist/theme.generated.json' },
      // theme.json 与运行时路径不会进入普通 TS 图片 import 图，显式保留两主题资源。
      { from: 'src/assets/tabbar', to: 'dist/assets/tabbar' },
    ],
  },
  mini: {
    // 字号和触控尺寸使用逻辑 px，不随 320/430px 屏幕等比缩放；流式宽度由布局处理。
    postcss: {
      pxtransform: { enable: false },
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
});
