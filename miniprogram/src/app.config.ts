export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/components/index',
    'pages/settings/index',
    'pages/login/index',
  ],
  darkmode: true,
  themeLocation: 'theme.generated.json',
  window: {
    navigationStyle: 'default',
    navigationBarTitleText: '应用',
    navigationBarBackgroundColor: '@navigationBackground',
    navigationBarTextStyle: '@navigationText',
    backgroundColor: '@background',
  },
  tabBar: {
    color: '@tabText',
    selectedColor: '@tabSelected',
    backgroundColor: '@tabBackground',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/components/index', text: '组件' },
      { pagePath: 'pages/settings/index', text: '设置' },
    ],
  },
  lazyCodeLoading: 'requiredComponents',
});
