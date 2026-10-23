import heroImage from '../../assets/library/hero.webp';
import { useState } from 'react';
import { Image, Text, View, Button as NativeButton } from '@tarojs/components';
import { PageShell } from '../../shared/ui';
import { LibraryIcon, SearchBox } from '../../features/component-library/visuals';
import {
  navigateToDemo,
  openCatalog,
  showReferenceEntry,
} from '../../features/component-library/navigation';
import styles from './index.module.scss';

const recentExamples = [
  {
    title: '输入框',
    detail: '表单输入、校验、状态反馈',
    time: '今天 14:20',
    icon: 'input',
    group: 'controls',
    section: 'input',
  },
  {
    title: '列表单元',
    detail: '信息展示、导航与操作',
    time: '昨天 10:36',
    icon: 'list',
    group: 'content',
    section: 'list',
  },
  {
    title: '卡片',
    detail: '内容容器与信息展示',
    time: '10-18 16:24',
    icon: 'card',
    group: 'content',
    section: 'feed',
  },
] as const;
export default function HomePage() {
  const [query, setQuery] = useState('');
  return (
    <PageShell>
      <View className={styles.hero}>
        <View className={styles.intro}>
          <Text className={styles.title}>高质量的{'\n'}移动端组件库</Text>
          <Text className={styles.subtitle}>基础组件与使用指南，{'\n'}让小程序开发更轻松。</Text>
        </View>
        <Image className={styles.heroImage} src={heroImage} mode="aspectFill" />
      </View>
      <SearchBox
        value={query}
        onChange={setQuery}
        onConfirm={() => {
          void openCatalog(query);
        }}
        placeholder="搜索组件、功能或关键词"
      />
      <View className={styles.shortcuts}>
        <NativeButton
          className={styles.browse}
          onClick={() => {
            void openCatalog();
          }}
          hoverClass={styles.pressed}
        >
          <View className={styles.roundIcon}>
            <LibraryIcon name="layers" tone="primary" />
          </View>
          <View className={styles.copy}>
            <Text className={styles.entryTitle}>浏览组件库</Text>
            <Text className={styles.detail}>按分类查找，预览组件与交互</Text>
          </View>
          <LibraryIcon name="arrow" />
        </NativeButton>
        <View className={styles.secondaryEntries}>
          <NativeButton
            className={styles.shortcut}
            onClick={() => showReferenceEntry('我的收藏')}
            hoverClass={styles.pressed}
          >
            <LibraryIcon name="bookmark" tone="muted" />
            <View className={styles.copy}>
              <Text className={styles.entryTitle}>我的收藏</Text>
              <Text className={styles.detail}>常用组件</Text>
            </View>
          </NativeButton>
          <NativeButton
            className={styles.shortcut}
            onClick={() => showReferenceEntry('使用指南')}
            hoverClass={styles.pressed}
          >
            <LibraryIcon name="book" tone="muted" />
            <View className={styles.copy}>
              <Text className={styles.entryTitle}>使用指南</Text>
              <Text className={styles.detail}>快速上手</Text>
            </View>
          </NativeButton>
        </View>
      </View>
      <View className={styles.recent}>
        <View className={styles.recentHeader}>
          <Text className={styles.sectionTitle}>最近使用</Text>
          <NativeButton
            className={styles.all}
            onClick={() => {
              void openCatalog();
            }}
          >
            查看全部
            <LibraryIcon name="arrow" tone="muted" />
          </NativeButton>
        </View>
        {recentExamples.map((item) => (
          <NativeButton
            key={item.title}
            className={styles.recentRow}
            onClick={() => {
              void navigateToDemo(item.group, item.section);
            }}
            hoverClass={styles.pressed}
          >
            <View className={styles.cellIcon}>
              <LibraryIcon name={item.icon} tone="primary" />
            </View>
            <View className={styles.copy}>
              <Text className={styles.entryTitle}>{item.title}</Text>
              <Text className={styles.detail}>{item.detail}</Text>
            </View>
            <Text className={styles.time}>{item.time}</Text>
          </NativeButton>
        ))}
      </View>
    </PageShell>
  );
}
