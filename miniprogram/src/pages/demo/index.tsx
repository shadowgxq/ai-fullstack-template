import avatarImage from '../../assets/library/avatar.jpg';
import { useState } from 'react';
import Taro, { useLoad, useReady, useRouter } from '@tarojs/taro';
import {
  Image,
  Picker,
  Progress,
  Switch,
  Text,
  View,
  Button as NativeButton,
} from '@tarojs/components';
import { PageShell, Title, Body, Field, Button, Notice, StatePanel } from '../../shared/ui';
import { nativeThemes } from '../../shared/theme/native.generated';
import { useTheme } from '../../shared/theme/preferences';
import { demoTitles, parseDemoGroup } from '../../features/component-library/catalog';
import { DemoHeading, LibraryIcon, SearchBox } from '../../features/component-library/visuals';
import { showReferenceEntry } from '../../features/component-library/navigation';
import styles from './index.module.scss';
import { OverlaysDemoPage } from '../../features/component-library/overlays-demo';
import { GesturesDemoPage } from '../../features/component-library/gestures-demo';

function ControlsDemo() {
  const [tab, setTab] = useState('推荐');
  const [segment, setSegment] = useState('全部');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [chips, setChips] = useState(['轻量', '简洁']);
  const [city, setCity] = useState(0);
  const theme = useTheme();
  return (
    <>
      <View className={styles.panel} id="navigation">
        <Title section>导航切换</Title>
        <View className={styles.tabs}>
          {['推荐', '关注', '最新'].map((item) => (
            <NativeButton
              key={item}
              className={`${styles.tab} ${tab === item ? styles.selectedTab : ''}`}
              onClick={() => setTab(item)}
            >
              {item}
            </NativeButton>
          ))}
        </View>
        <View className={styles.segment}>
          {['全部', '未读'].map((item) => (
            <NativeButton
              key={item}
              className={`${styles.segmentOption} ${segment === item ? styles.selectedSegment : ''}`}
              onClick={() => setSegment(item)}
            >
              {item}
            </NativeButton>
          ))}
        </View>
      </View>
      <View className={styles.panel} id="buttons">
        <Title section>按钮操作</Title>
        <View className={styles.buttonRow}>
          <View className={styles.save}>
            <Button
              onClick={() => {
                setSubmitted(true);
                if (name.trim()) void Taro.showToast({ title: '输入格式正确', icon: 'none' });
              }}
            >
              保存
            </Button>
          </View>
          <NativeButton
            className={styles.iconButton}
            ariaLabel="更多操作"
            onClick={() => showReferenceEntry('更多操作')}
          >
            <LibraryIcon name="more" />
          </NativeButton>
        </View>
      </View>
      <View className={styles.panel} id="input">
        <Title section>文本输入</Title>
        <Field
          id="sample-name"
          label="昵称"
          value={name}
          onValueChange={setName}
          placeholder="请输入昵称"
          error={submitted && !name.trim() ? '请输入昵称' : undefined}
        />
        <SearchBox value={search} onChange={setSearch} placeholder="搜索组件" />
        {submitted && name.trim() ? (
          <Notice tone="success">输入格式正确，未提交到服务端。</Notice>
        ) : null}
      </View>
      <View className={styles.panel}>
        <Title section>选择控件</Title>
        <View className={styles.choices}>
          <NativeButton
            className={styles.choice}
            ariaRole="checkbox"
            ariaChecked={checked}
            onClick={() => setChecked(!checked)}
          >
            <View className={`${styles.checkbox} ${checked ? styles.checked : ''}`}>
              {checked ? '✓' : ''}
            </View>
            接收通知
          </NativeButton>
          <NativeButton
            className={styles.choice}
            ariaRole="radio"
            ariaChecked={radio}
            onClick={() => setRadio(true)}
          >
            <View className={`${styles.radio} ${radio ? styles.checked : ''}`}>
              {radio ? '•' : ''}
            </View>
            站内通知
          </NativeButton>
        </View>
        <View className={styles.line}>
          <Text>消息提醒</Text>
          <Switch
            checked={reminders}
            color={nativeThemes[theme].tabSelected}
            onChange={(e) => setReminders(e.detail.value)}
            ariaLabel="消息提醒"
          />
        </View>
        <Body secondary>Filter Chips</Body>
        <View className={styles.chips}>
          {['轻量', '原生', '简洁'].map((item) => (
            <NativeButton
              key={item}
              className={`${styles.chip} ${chips.includes(item) ? styles.activeChip : ''}`}
              onClick={() =>
                setChips(chips.includes(item) ? chips.filter((v) => v !== item) : [...chips, item])
              }
            >
              {chips.includes(item) ? '✓ ' : ''}
              {item}
            </NativeButton>
          ))}
        </View>
        <Picker
          mode="selector"
          range={['杭州', '上海', '北京']}
          value={city}
          onChange={(e) => setCity(Number(e.detail.value))}
        >
          <View className={styles.line}>
            <Text>城市</Text>
            <View className={styles.city}>
              <Text>{['杭州', '上海', '北京'][city]}</Text>
              <LibraryIcon name="arrow" tone="muted" />
            </View>
          </View>
        </Picker>
      </View>
    </>
  );
}
function ContentDemo() {
  return (
    <>
      <View className={styles.feedSection} id="feed">
        <Title section>内容卡片</Title>
        <View className={styles.feed}>
          <View className={styles.author}>
            <Image className={styles.avatar} src={avatarImage} mode="aspectFill" />
            <View className={styles.authorCopy}>
              <View className={styles.authorTitle}>
                <Text className={styles.medium}>小林 · 设计笔记</Text>
                <Text className={styles.tag}>精选</Text>
              </View>
              <Body secondary>今天 09:41 · 原创</Body>
            </View>
            <NativeButton
              className={styles.more}
              ariaLabel="更多内容操作"
              onClick={() => showReferenceEntry('内容操作')}
            >
              <LibraryIcon name="more" tone="muted" />
            </NativeButton>
          </View>
          <View className={styles.feedCopy}>
            <Title section>好的组件，让内容成为主角</Title>
            <Body secondary>把常用操作留在触手可及的位置。</Body>
          </View>
          <View className={styles.feedActions}>
            {(
              [
                ['message', '评论 3'],
                ['bookmark', '收藏'],
                ['share', '分享'],
              ] as const
            ).map(([icon, label]) => (
              <NativeButton
                key={label}
                className={styles.feedAction}
                onClick={() => showReferenceEntry(label)}
              >
                <LibraryIcon name={icon} tone="muted" />
                {label}
              </NativeButton>
            ))}
          </View>
        </View>
      </View>
      <View className={styles.panel} id="list">
        <Title section>列表单元</Title>
        <NativeButton className={styles.cell} onClick={() => showReferenceEntry('组件更新')}>
          <View className={styles.cellIcon}>
            <LibraryIcon name="layers" tone="primary" />
          </View>
          <View className={styles.authorCopy}>
            <Text className={styles.medium}>组件更新</Text>
            <Body secondary>查看最近更新</Body>
          </View>
          <LibraryIcon name="arrow" tone="muted" />
        </NativeButton>
        <View className={styles.divider} />
        <View className={styles.line}>
          <Text>未读消息</Text>
          <Text className={styles.badge}>3</Text>
        </View>
      </View>
    </>
  );
}
function FeedbackDemo() {
  const theme = useTheme();
  return (
    <>
      <View className={styles.panel}>
        <Title section>加载反馈</Title>
        <View className={styles.loading}>
          <View className={styles.spinner} />
          <Body secondary>正在加载</Body>
        </View>
        <View className={styles.skeleton}>
          <View className={styles.skeletonHeader}>
            <View className={styles.skeletonAvatar} />
            <View className={styles.skeletonTitles}>
              <View />
              <View />
            </View>
          </View>
          <View />
          <View />
        </View>
        <Body secondary>进度 · 60%</Body>
        <Progress
          percent={60}
          showInfo={false}
          strokeWidth={6}
          activeColor={nativeThemes[theme].tabSelected}
          backgroundColor={nativeThemes[theme].progressTrack}
          borderRadius={3}
        />
      </View>
      <View className={styles.panel}>
        <Title section>操作结果</Title>
        <View className={styles.toastArea}>
          <View className={styles.toast}>
            <Text>✓</Text>
            <Text>已保存到收藏</Text>
          </View>
        </View>
        <View className={styles.error}>
          <Text>ⓘ</Text>
          <Text className={styles.grow}>加载失败</Text>
          <NativeButton
            className={styles.retry}
            onClick={() => {
              void Taro.showToast({ title: '错误状态示例', icon: 'none' });
            }}
          >
            重试
          </NativeButton>
        </View>
        <View className={styles.empty}>
          <LibraryIcon name="bookmark" tone="muted" />
          <Text>还没有收藏</Text>
          <Body secondary>收藏的内容将出现在这里</Body>
        </View>
      </View>
    </>
  );
}
export default function DemoPage() {
  const router = useRouter();
  const group = parseDemoGroup(router.params.group);
  useLoad((params) => {
    const next = parseDemoGroup(params.group);
    if (next) void Taro.setNavigationBarTitle({ title: demoTitles[next] });
  });
  useReady(() => {
    const section = router.params.section;
    if (section && ['navigation', 'buttons', 'input', 'feed', 'list'].includes(section))
      void Taro.pageScrollTo({ selector: `#${section}`, duration: 0 });
  });
  if (!group)
    return (
      <PageShell>
        <StatePanel
          state="error"
          title="未找到组件演示"
          detail="请返回组件库，选择要查看的分类。"
          onRetry={() => {
            void Taro.navigateTo({ url: '/pages/components/index' });
          }}
        />
      </PageShell>
    );
  if (group === 'overlays') return <OverlaysDemoPage />;
  if (group === 'gestures') return <GesturesDemoPage />;
  return (
    <PageShell>
      <DemoHeading title={demoTitles[group]} />
      {group === 'controls' ? (
        <ControlsDemo />
      ) : group === 'content' ? (
        <ContentDemo />
      ) : (
        <FeedbackDemo />
      )}
    </PageShell>
  );
}
