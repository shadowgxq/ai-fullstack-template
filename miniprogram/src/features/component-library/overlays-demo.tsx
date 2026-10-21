import { useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { PageMeta, Text, View, Button as NativeButton } from '@tarojs/components';
import { PageShell, Title, Body, Button, Notice } from '../../shared/ui';
import { useTheme } from '../../shared/theme/preferences';
import { errorMessage, isRecord } from '../../shared/api/errors';
import { DemoHeading, LibraryIcon } from './visuals';
import { readTouchPoint } from './gestures';
import styles from './overlays-demo.module.scss';

type ContentFilter = '全部' | '文章' | '图片';
const contentTypes: ContentFilter[] = ['全部', '文章', '图片'];
const filterExamples = [
  { title: '设计中的小细节', type: '文章' },
  { title: '原生交互笔记', type: '文章' },
  { title: '组件灵感图集', type: '图片' },
];
export function OverlaysDemoPage() {
  const theme = useTheme();
  const [opened, setOpened] = useState(false);
  const [applied, setApplied] = useState<ContentFilter>('文章');
  const [draft, setDraft] = useState<ContentFilter>('文章');
  const [deltaY, setDeltaY] = useState(0);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nativeBusy = useRef(false);
  const touchStart = useRef<number | null>(null);
  const closeSheet = () => {
    setOpened(false);
    setDeltaY(0);
    touchStart.current = null;
  };
  const openSheet = () => {
    setDraft(applied);
    setDeltaY(0);
    setOpened(true);
    setError(null);
  };
  const showNative = async (kind: 'dialog' | 'actions') => {
    if (nativeBusy.current) return;
    nativeBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'dialog') {
        const response = await Taro.showModal({
          title: '保存当前设置？',
          content: '确认后仅更新当前组件示例，不会提交到服务器。',
          confirmText: '确认',
          cancelText: '取消',
        });
        setResult(response.confirm ? '已确认当前设置' : '已取消操作');
      } else {
        const actions = ['查看使用说明', '恢复默认筛选', '复制示例标题'];
        const response = await Taro.showActionSheet({ itemList: actions });
        if (response.tapIndex === 0) {
          await Taro.showModal({
            title: '使用说明',
            content:
              '底部弹层可选择内容类型，点击应用更新列表；点击遮罩、关闭按钮或下滑手柄可取消临时选择。',
            showCancel: false,
          });
          setResult('已查看使用说明');
        } else if (response.tapIndex === 1) {
          setApplied('文章');
          setResult('已恢复默认筛选：文章');
        } else if (response.tapIndex === 2) {
          await Taro.setClipboardData({ data: filterExamples[0].title });
          setResult('已复制示例标题');
        }
      }
    } catch (cause) {
      if (isRecord(cause) && typeof cause.errMsg === 'string' && /cancel/i.test(cause.errMsg))
        setResult('已取消操作');
      else setError(errorMessage(cause));
    } finally {
      nativeBusy.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <PageMeta pageStyle={opened ? 'overflow:hidden;' : ''} />
      <PageShell>
        <DemoHeading subtitle="页面级弹出 · 原生与自定义" title="弹窗与弹层" />
        <View className={styles.section}>
          <Title section>对话框 · Dialog</Title>
          <Body secondary>确认与取消均使用页面级原生弹窗。</Body>
          <Button
            disabled={busy}
            onClick={() => {
              void showNative('dialog');
            }}
          >
            打开对话框
          </Button>
        </View>
        <View className={styles.section}>
          <Title section>动作面板 · Action Sheet</Title>
          <Body secondary>从页面底部选择一项操作，可取消返回。</Body>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void showNative('actions');
            }}
          >
            打开动作面板
          </Button>
        </View>
        <View className={styles.section}>
          <Title section>底部弹层 · Bottom Sheet</Title>
          <Body secondary>当前筛选：{applied}。关闭弹层不会应用临时选择。</Body>
          <Button variant="secondary" onClick={openSheet}>
            打开筛选弹层
          </Button>
          <View className={styles.examples}>
            {filterExamples
              .filter((item) => applied === '全部' || item.type === applied)
              .map((item) => (
                <View className={styles.example} key={item.title}>
                  <Text>{item.title}</Text>
                  <Text className={styles.muted}>{item.type}</Text>
                </View>
              ))}
          </View>
        </View>
        {result ? <Notice>{result}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </PageShell>
      {opened ? (
        <View
          className={`mp-theme-root theme-${theme} ${styles.overlay}`}
          catchMove
          onTouchMove={(event) => event.stopPropagation()}
        >
          <View
            className={styles.backdrop}
            onClick={closeSheet}
            ariaRole="button"
            ariaLabel="关闭筛选弹层"
          />
          <View
            className={styles.sheet}
            style={{ transform: `translateY(${deltaY}px)` }}
            ariaRole="dialog"
            ariaLabel="筛选内容"
          >
            <View
              className={styles.dragHandle}
              catchMove
              onTouchStart={(event) => {
                event.stopPropagation();
                touchStart.current = readTouchPoint(event, 'touches')?.clientY ?? null;
              }}
              onTouchMove={(event) => {
                event.stopPropagation();
                const point = readTouchPoint(event, 'touches');
                if (point && touchStart.current !== null)
                  setDeltaY(Math.max(0, point.clientY - touchStart.current));
              }}
              onTouchEnd={(event) => {
                event.stopPropagation();
                const point = readTouchPoint(event, 'changedTouches');
                const moved =
                  point && touchStart.current !== null
                    ? point.clientY - touchStart.current
                    : deltaY;
                if (moved >= 72) closeSheet();
                else {
                  setDeltaY(0);
                  touchStart.current = null;
                }
              }}
              onTouchCancel={() => {
                setDeltaY(0);
                touchStart.current = null;
              }}
              ariaLabel="下滑关闭筛选弹层"
            >
              <View />
            </View>
            <View className={styles.sheetTitle}>
              <Title section>筛选内容</Title>
              <NativeButton className={styles.close} ariaLabel="关闭筛选" onClick={closeSheet}>
                <LibraryIcon name="close" tone="muted" />
              </NativeButton>
            </View>
            <Body secondary>内容类型</Body>
            <View className={styles.choices}>
              {contentTypes.map((type) => (
                <NativeButton
                  key={type}
                  className={`${styles.choice} ${draft === type ? styles.selected : ''}`}
                  onClick={() => setDraft(type)}
                >
                  {draft === type ? '✓ ' : ''}
                  {type}
                </NativeButton>
              ))}
            </View>
            <View className={styles.actions}>
              <View>
                <Button variant="secondary" onClick={() => setDraft('全部')}>
                  重置
                </Button>
              </View>
              <View>
                <Button
                  onClick={() => {
                    setApplied(draft);
                    setResult(`已应用筛选：${draft}`);
                    closeSheet();
                  }}
                >
                  应用筛选
                </Button>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}
