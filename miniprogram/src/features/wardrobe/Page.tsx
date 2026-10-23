import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, ScrollView, Text, View } from '@tarojs/components';
import { useTheme } from '../../shared/theme/preferences';
import { syncNativeTheme } from '../../shared/theme/native';
import { useWardrobeSession } from './session';
import { redirectToLogin } from '../auth/navigation';
import styles from './Page.module.scss';

interface HostGeometry {
  statusBarHeight: number;
  navigationHeight: number;
  capsuleSpace: number;
  windowHeight: number;
}
function readHostGeometry(): HostGeometry {
  const window = Taro.getWindowInfo();
  const statusBarHeight = window.statusBarHeight ?? 0;
  const capsule = Taro.getMenuButtonBoundingClientRect();
  if (!Number.isFinite(capsule.top) || capsule.height <= 0 || capsule.left <= 0)
    throw new Error('微信导航测量不可用');
  return {
    statusBarHeight,
    navigationHeight: Math.max(48, (capsule.top - statusBarHeight) * 2 + capsule.height),
    capsuleSpace: Math.max(48, window.windowWidth - capsule.left + 8),
    windowHeight: window.windowHeight,
  };
}
export function openWardrobe(): Promise<unknown> {
  return Taro.reLaunch({ url: '/pages/wardrobe/index' });
}

/** 顶栏、中间滚动和底部操作分别拥有空间，系统胶囊与指示器不由业务重绘。 */
export function WardrobePage({
  title,
  children,
  footer,
  bottomNavigation,
  account = false,
  tone = 'default',
  publicPage = false,
  onReachBottom,
  navigationLocked = false,
}: PropsWithChildren<{
  title: string;
  footer?: ReactNode;
  bottomNavigation?: ReactNode;
  account?: boolean;
  tone?: 'default' | 'profile' | 'settings';
  publicPage?: boolean;
  onReachBottom?: () => void;
  navigationLocked?: boolean;
}>) {
  const theme = useTheme();
  const session = useWardrobeSession();
  const checkSession = () => {
    if (!publicPage && !session) void redirectToLogin();
  };
  useEffect(checkSession, [publicPage, session]);
  useDidShow(checkSession);
  const [geometry, setGeometry] = useState<HostGeometry | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    try {
      setGeometry(readHostGeometry());
    } catch {
      setGeometry(null);
    }
    const onKeyboard = ({ height }: { height: number }) => setKeyboardHeight(Math.max(0, height));
    Taro.onKeyboardHeightChange(onKeyboard);
    return () => Taro.offKeyboardHeightChange(onKeyboard);
  }, []);
  const syncTheme = () => {
    void syncNativeTheme(theme, false);
  };
  useEffect(syncTheme, [theme]);
  useDidShow(syncTheme);
  if (!publicPage && !session) return null;
  return (
    <View
      className={`mp-theme-root theme-${theme} ${styles.page} ${tone === 'profile' ? styles.profilePage : tone === 'settings' ? styles.settingsPage : ''}`}
      style={geometry ? { height: Math.max(0, geometry.windowHeight - keyboardHeight) } : undefined}
    >
      <View
        className={styles.navigation}
        style={
          geometry
            ? {
                paddingTop: geometry.statusBarHeight,
                minHeight:
                  tone === 'default'
                    ? geometry.navigationHeight
                    : Math.max(56, geometry.navigationHeight),
              }
            : undefined
        }
      >
        {!publicPage ? (
          <Button
            className={styles.back}
            disabled={navigationLocked}
            style={geometry ? { width: geometry.capsuleSpace } : undefined}
            ariaLabel={account ? '账户' : '返回'}
            onClick={() => {
              void (account
                ? Taro.navigateTo({ url: '/pages/personal/index' })
                : Taro.navigateBack().catch(openWardrobe));
            }}
          >
            {account ? (
              <Image
                className={styles.accountIcon}
                src={`/assets/library-icons/circle-user-round-${theme}-text.png`}
              />
            ) : (
              <View className={styles.chevron} />
            )}
          </Button>
        ) : (
          <View
            className={styles.back}
            style={geometry ? { width: geometry.capsuleSpace } : undefined}
          >
            {account ? (
              <Image
                className={styles.accountIcon}
                src={`/assets/library-icons/circle-user-round-${theme}-text.png`}
              />
            ) : null}
          </View>
        )}
        <Text className={styles.title}>{title}</Text>
        <View
          style={geometry ? { width: geometry.capsuleSpace } : undefined}
          className={styles.capsuleSpace}
        />
      </View>
      <ScrollView scrollY className={styles.scroll} onScrollToLower={onReachBottom} enhanced>
        <View
          className={`${styles.content} ${!footer && !bottomNavigation ? styles.withoutFooter : ''}`}
        >
          {children}
        </View>
      </ScrollView>
      {footer && keyboardHeight === 0 ? (
        <View className={`${styles.footer} ${bottomNavigation ? styles.footerWithNavigation : ''}`}>
          {footer}
        </View>
      ) : null}
      {bottomNavigation && keyboardHeight === 0 ? (
        <View className={styles.bottomNavigation}>{bottomNavigation}</View>
      ) : null}
    </View>
  );
}
