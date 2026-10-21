export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/components/index',
    'pages/settings/index',
    'pages/login/index',
    'pages/demo/index',
    'pages/preferences/index',
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
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: '@tabHomeIcon',
        selectedIconPath: '@tabHomeSelectedIcon',
      },
      {
        pagePath: 'pages/components/index',
        text: '组件',
        iconPath: '@tabComponentsIcon',
        selectedIconPath: '@tabComponentsSelectedIcon',
      },
      {
        pagePath: 'pages/settings/index',
        text: '我的',
        iconPath: '@tabProfileIcon',
        selectedIconPath: '@tabProfileSelectedIcon',
      },
    ],
  },
  lazyCodeLoading: 'requiredComponents',
});
