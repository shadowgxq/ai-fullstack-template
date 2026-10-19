/// <reference types="@tarojs/taro" />

declare const __API_BASE_URL__: string;
declare const __APP_VERSION__: string;

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}
declare module '*.scss';
