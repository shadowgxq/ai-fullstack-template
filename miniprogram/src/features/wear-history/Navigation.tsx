import Taro from '@tarojs/taro';
import { Button, Image, Text, View } from '@tarojs/components';
import { useTheme } from '../../shared/theme/preferences';
import styles from './wear-history.module.scss';

export function WardrobeNavigation({ active }: { active: 'wardrobe' | 'outfits' | 'records' }) {
  const theme = useTheme();
  return (
    <View className={styles.navigation}>
      {(
        [
          { id: 'wardrobe', label: '衣柜', url: '/pages/wardrobe/index' },
          { id: 'outfits', label: '穿搭', url: '/pages/outfits/index' },
          { id: 'records', label: '记录', url: '/pages/wear-history/index' },
        ] as const
      ).map((item) => (
        <Button
          key={item.id}
          className={`${styles.navigationItem} ${active === item.id ? styles.navigationActive : ''}`}
          onClick={() => {
            if (active !== item.id)
              void Taro.redirectTo({ url: item.url }).catch(() =>
                Taro.showToast({ title: '页面暂时无法打开，请重试', icon: 'none' }),
              );
          }}
        >
          <Image
            className={styles.navigationIcon}
            src={`/assets/library-icons/${item.id === 'wardrobe' ? 'shirt' : item.id === 'outfits' ? 'sparkles' : 'history'}-${theme}-${active === item.id ? 'primary' : 'muted'}.png`}
          />
          <Text>{item.label}</Text>
        </Button>
      ))}
    </View>
  );
}
