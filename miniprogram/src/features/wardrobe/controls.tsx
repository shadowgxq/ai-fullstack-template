import { type PropsWithChildren, type ReactNode } from 'react';
import { Button as NativeButton, Image, ScrollView, Text, View } from '@tarojs/components';
import topsImage from '../../assets/wardrobe/categories/tops.png';
import bottomsImage from '../../assets/wardrobe/categories/bottoms.png';
import shoesImage from '../../assets/wardrobe/categories/shoes.png';
import { Button } from '../../shared/ui';
import styles from './wardrobe.module.scss';
import { WardrobeIcon } from './Icon';

export interface Choice {
  id: string;
  label: string;
}
export function ColorChoices({
  options,
  value,
  onChange,
  onMore,
  disabled = false,
}: {
  options: readonly Choice[];
  value: string | null;
  onChange: (value: string | null) => void;
  onMore: () => void;
  disabled?: boolean;
}) {
  const quick = ['white', 'black', 'gray', 'blue', 'beige', 'green'].flatMap((id) =>
    options.filter((option) => option.id === id),
  );
  const extra =
    value && !quick.some((option) => option.id === value)
      ? (options.find((option) => option.id === value) ?? { id: value, label: value })
      : null;
  return (
    <View className={styles.colorChoices}>
      {quick.map((color) => (
        <NativeButton
          key={color.id}
          disabled={disabled}
          ariaLabel={color.label + (value === color.id ? '，已选中' : '')}
          className={`${styles.colorChoice} ${value === color.id ? styles.selected : ''}`}
          onClick={() => onChange(value === color.id ? null : color.id)}
        >
          <View className={`${styles.swatch} ${styles['swatch_' + color.id] ?? ''}`}>
            {value === color.id ? <Text className={styles.colorCheck}>✓</Text> : null}
          </View>
        </NativeButton>
      ))}
      {extra ? (
        <NativeButton
          className={`${styles.chip} ${styles.selected}`}
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <View className={styles.chipFace}>✓ {extra.label}</View>
        </NativeButton>
      ) : null}
      <NativeButton
        className={styles.colorChoice}
        ariaLabel="更多颜色"
        disabled={disabled}
        onClick={onMore}
      >
        •••
      </NativeButton>
    </View>
  );
}
export function Chips({
  options,
  values,
  onChange,
  disabled = false,
  scroll = false,
}: {
  options: readonly Choice[];
  values: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  scroll?: boolean;
}) {
  const choices = (
    <View className={`${styles.chips} ${scroll ? styles.chipsRow : ''}`}>
      {options.map((option) => (
        <NativeButton
          key={option.id}
          className={`${styles.chip} ${values.includes(option.id) ? styles.selected : ''}`}
          disabled={disabled}
          ariaLabel={option.label + (values.includes(option.id) ? '，已选中' : '')}
          onClick={() => onChange(option.id)}
        >
          <View className={styles.chipFace}>
            {values.includes(option.id) ? '✓ ' : ''}
            {option.label}
          </View>
        </NativeButton>
      ))}
    </View>
  );
  return scroll ? (
    <ScrollView scrollX className={styles.chipScroll}>
      {choices}
    </ScrollView>
  ) : (
    choices
  );
}
export function Sheet({
  title,
  children,
  footer,
  onClose,
  busy = false,
}: PropsWithChildren<{ title: string; onClose: () => void; busy?: boolean; footer?: ReactNode }>) {
  return (
    <View
      className={styles.overlay}
      catchMove
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <View
        className={`${styles.sheet} ${footer ? styles.sheetWithFooter : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <View className={styles.sheetHeading}>
          <Text>{title}</Text>
          <NativeButton className={styles.close} ariaLabel="关闭" disabled={busy} onClick={onClose}>
            ×
          </NativeButton>
        </View>
        <ScrollView scrollY className={styles.sheetScroll}>
          {children}
        </ScrollView>
        {footer ? <View className={styles.sheetFooter}>{footer}</View> : null}
      </View>
    </View>
  );
}
export function ChoiceSheet({
  title,
  options,
  value,
  onChoose,
  onClose,
  kind = 'category',
}: {
  title: string;
  options: readonly Choice[];
  value: string | null;
  onChoose: (value: string | null) => void;
  onClose: () => void;
  kind?: 'category' | 'color';
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <View className={styles.stack}>
        {kind === 'category' ? (
          <Text className={styles.caption}>选择主要类别，之后可随时修改</Text>
        ) : null}
        <View className={kind === 'color' ? styles.colorGrid : styles.stack}>
          {options.map((option) => (
            <NativeButton
              key={option.id}
              ariaLabel={(value === option.id ? '✓ ' : '') + option.label}
              className={`${kind === 'color' ? styles.colorChoice : styles.categoryOption} ${value === option.id ? styles.selected : ''}`}
              onClick={() => onChoose(option.id)}
            >
              {kind === 'color' ? (
                <View className={`${styles.swatch} ${styles['swatch_' + option.id] ?? ''}`}>
                  {value === option.id ? <Text className={styles.colorCheck}>✓</Text> : null}
                </View>
              ) : (
                <View className={styles.categoryIcon}>
                  {option.id === 'tops' || option.id === 'bottoms' || option.id === 'shoes' ? (
                    <Image
                      className={styles.categoryImage}
                      src={
                        option.id === 'tops'
                          ? topsImage
                          : option.id === 'bottoms'
                            ? bottomsImage
                            : shoesImage
                      }
                      mode="aspectFill"
                    />
                  ) : (
                    <WardrobeIcon
                      name={option.id === 'shoes' ? 'footprints' : 'shirt'}
                      tone="muted"
                    />
                  )}
                </View>
              )}
              <Text className={kind === 'category' ? styles.categoryLabel : undefined}>
                {option.label}
              </Text>
              {kind === 'category' ? (
                <Text className={styles.choiceMarker}>{value === option.id ? '✓' : ''}</Text>
              ) : null}
            </NativeButton>
          ))}
        </View>
        <Button variant="secondary" onClick={() => onChoose(null)}>
          {kind === 'color' ? '清除颜色' : '清除分类'}
        </Button>
      </View>
    </Sheet>
  );
}
export function statusLabel(status: 'wearable' | 'unavailable' | 'archived'): string {
  return status === 'wearable' ? '可穿' : status === 'unavailable' ? '暂不可穿' : '已归档';
}
