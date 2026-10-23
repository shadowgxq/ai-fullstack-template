import { Image } from '@tarojs/components';
import { useTheme } from '../../shared/theme/preferences';
import styles from './wardrobe.module.scss';

export function WardrobeIcon({
  name,
  tone = 'text',
}: {
  name: string;
  tone?: 'text' | 'muted' | 'primary';
}) {
  const theme = useTheme();
  return (
    <Image className={styles.icon} src={`/assets/library-icons/${name}-${theme}-${tone}.png`} />
  );
}
