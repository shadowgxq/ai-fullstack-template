import { useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { Text, View, Button as NativeButton } from '@tarojs/components';
import { PageShell, StatePanel } from '../../shared/ui';
import { LibraryIcon, SearchBox, CategoryPreview } from '../../features/component-library/visuals';
import {
  catalogFilters,
  filterCategories,
  type CatalogFilter,
} from '../../features/component-library/catalog';
import { consumeCatalogQuery, navigateToDemo } from '../../features/component-library/navigation';
import styles from './index.module.scss';

export default function ComponentsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('全部');
  useDidShow(() => {
    const next = consumeCatalogQuery();
    if (next !== null) {
      setQuery(next);
      setFilter('全部');
    }
  });
  const categories = filterCategories(query, filter);
  return (
    <PageShell withTabBar compact>
      <SearchBox value={query} onChange={setQuery} />
      <View className={styles.filters}>
        {catalogFilters.map((item) => (
          <NativeButton
            className={`${styles.filter} ${filter === item ? styles.active : ''}`}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item}
          </NativeButton>
        ))}
      </View>
      <View className={styles.categories}>
        {categories.map((item) => (
          <NativeButton
            key={item.id}
            className={styles.category}
            hoverClass={styles.pressed}
            onClick={() => {
              void navigateToDemo(item.group, item.section);
            }}
          >
            <View className={styles.copy}>
              <Text className={styles.title}>{item.title}</Text>
              <Text className={styles.detail}>{item.description}</Text>
              <Text className={styles.count}>{item.count} 个组件</Text>
            </View>
            <CategoryPreview kind={item.id} />
            <View className={styles.arrow}>
              <LibraryIcon name="arrow" tone="muted" />
            </View>
          </NativeButton>
        ))}
        {!categories.length ? (
          <StatePanel
            state="empty"
            title={query ? '没有找到相关组件' : '暂无此类组件'}
            detail="试试其他关键词或切换分类。"
          />
        ) : null}
      </View>
    </PageShell>
  );
}
