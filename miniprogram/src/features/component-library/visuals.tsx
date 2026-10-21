import { Image, Input, Text, View, Button as NativeButton } from '@tarojs/components';
import { useTheme } from '../../shared/theme/preferences';
import styles from './visuals.module.scss';

export type LibraryIconName =
  | 'layers'
  | 'bookmark'
  | 'book'
  | 'input'
  | 'list'
  | 'card'
  | 'arrow'
  | 'search'
  | 'settings'
  | 'clipboard'
  | 'info'
  | 'home'
  | 'grid'
  | 'profile'
  | 'more'
  | 'check'
  | 'close'
  | 'message'
  | 'share'
  | 'grip';
export function LibraryIcon({
  name,
  tone = 'text',
}: {
  name: LibraryIconName;
  tone?: 'text' | 'muted' | 'primary';
}) {
  const theme = useTheme();
  return (
    <Image
      className={styles.icon}
      src={`/assets/library-icons/${name}-${theme}-${tone}.png`}
      mode="aspectFit"
    />
  );
}
export function SearchBox({
  value,
  onChange,
  onConfirm,
  placeholder = '搜索组件名称或功能',
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  placeholder?: string;
}) {
  return (
    <View className={styles.search}>
      <LibraryIcon name="search" tone="muted" />
      <Input
        className={styles.searchInput}
        ariaLabel={placeholder}
        value={value}
        placeholder={placeholder}
        placeholderClass={styles.placeholder}
        confirmType="search"
        onInput={(e) => onChange(e.detail.value)}
        onConfirm={onConfirm}
      />
      {value ? (
        <NativeButton className={styles.clear} ariaLabel="清空搜索" onClick={() => onChange('')}>
          <LibraryIcon name="close" tone="muted" />
        </NativeButton>
      ) : null}
    </View>
  );
}
export function CategoryPreview({ kind }: { kind: string }) {
  return (
    <View className={styles.preview} ariaHidden>
      {kind === 'form' ? (
        <>
          <View className={styles.miniInput}>
            <View className={styles.tintLine} />
          </View>
          <View className={styles.miniInput}>
            <View className={styles.shortLine} />
            <View className={styles.miniSwitch} />
          </View>
        </>
      ) : null}
      {kind === 'buttons' ? (
        <>
          <View className={styles.miniButton} />
          <View className={styles.shortLine} />
        </>
      ) : null}
      {kind === 'content' ? (
        <View className={styles.miniInput}>
          <LibraryIcon name="card" tone="muted" />
          <View className={styles.miniLines}>
            <View />
            <View />
            <View />
          </View>
        </View>
      ) : null}
      {kind === 'feedback' ? (
        <View className={styles.miniInput}>
          <LibraryIcon name="check" tone="primary" />
          <View className={styles.miniLines}>
            <View />
            <View />
          </View>
        </View>
      ) : null}
      {kind === 'overlays' || kind === 'gestures' ? (
        <View className={styles.miniInput}>
          <LibraryIcon name={kind === 'overlays' ? 'layers' : 'grip'} tone="primary" />
          <View className={styles.miniLines}>
            <View />
            <View />
          </View>
        </View>
      ) : null}
      {kind === 'navigation' ? (
        <>
          <View className={styles.miniInput}>
            <LibraryIcon name="home" tone="primary" />
            <LibraryIcon name="card" tone="muted" />
            <LibraryIcon name="profile" tone="muted" />
          </View>
          <View className={styles.tabLine} />
        </>
      ) : null}
    </View>
  );
}
export function DemoHeading({
  title,
  subtitle = '基础组件 · 单一样例',
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className={styles.heading}>
      <Text className={styles.headingTitle}>{title}</Text>
      <Text className={styles.headingSubtitle}>{subtitle}</Text>
    </View>
  );
}
