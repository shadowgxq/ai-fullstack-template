import type { PropsWithChildren } from 'react';
import { Text, View } from '@tarojs/components';
import { Button, Field, Notice } from '../../shared/ui';
import styles from './weather.module.scss';

export function CitySearchForm({
  query,
  currentLabel,
  locating,
  saving,
  error,
  onQuery,
  onLocate,
  children,
}: PropsWithChildren<{
  query: string;
  currentLabel: string;
  locating: boolean;
  saving: boolean;
  error: string | null;
  onQuery: (query: string) => void;
  onLocate: () => void;
}>) {
  return (
    <View className={styles.stack}>
      <Button
        variant="secondary"
        loading={locating}
        disabled={saving}
        onClick={() => {
          if (!saving && !locating) onLocate();
        }}
      >
        使用当前位置
      </Button>
      <Field
        id="weather-city-search"
        label="手动选择城市"
        value={query}
        placeholder="输入城市名称"
        maxLength={80}
        disabled={saving}
        onValueChange={(value) => {
          if (!saving) onQuery(value);
        }}
      />
      <Text className={styles.caption}>当前城市：{currentLabel}</Text>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {children}
      <Text className={styles.caption}>未提供位置或天气获取失败，不影响衣柜与穿着记录。</Text>
    </View>
  );
}
