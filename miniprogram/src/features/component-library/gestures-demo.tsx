import { useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { PageMeta, View, Button as NativeButton } from '@tarojs/components';
import { PageShell, Title, Body, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { DemoHeading } from './visuals';
import { swipeExamples, type ExampleRow } from './interaction-model';
import { SwipeRow } from './swipe-demo';
import { ReorderDemo } from './reorder-demo';
import styles from './gestures-demo.module.scss';

export function GesturesDemoPage() {
  const [rows, setRows] = useState<ExampleRow[]>(() => swipeExamples.map((row) => ({ ...row })));
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nativeBusy = useRef(false);
  const details = async (row: ExampleRow) => {
    if (nativeBusy.current) return;
    nativeBusy.current = true;
    setOpenRowId(null);
    setError(null);
    try {
      await Taro.showModal({ title: row.title, content: row.detail, showCancel: false });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      nativeBusy.current = false;
    }
  };
  const remove = async (row: ExampleRow) => {
    if (nativeBusy.current) return;
    nativeBusy.current = true;
    setOpenRowId(null);
    setError(null);
    try {
      const response = await Taro.showModal({
        title: '删除这条示例？',
        content: row.title,
        confirmText: '删除',
        cancelText: '取消',
      });
      if (response.confirm) {
        setRows((current) => current.filter((item) => item.id !== row.id));
        setFeedback(`已删除“${row.title}”`);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      nativeBusy.current = false;
    }
  };
  return (
    <>
      <PageMeta pageStyle={dragging ? 'overflow:hidden;' : ''} />
      <PageShell onClick={() => setOpenRowId(null)}>
        <DemoHeading subtitle="多项样例 · 侧滑与拖动" title="手势交互" />
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Title section>列表侧滑 · Swipe</Title>
            <NativeButton
              className={styles.reset}
              onClick={(event) => {
                event.stopPropagation();
                setRows(swipeExamples.map((row) => ({ ...row })));
                setOpenRowId(null);
                setFeedback('已恢复侧滑示例');
                setError(null);
              }}
            >
              重置
            </NativeButton>
          </View>
          <Body secondary>左滑显示操作，右滑或点击外部收起；点击内容查看详情。</Body>
          <View className={styles.swipeList}>
            {rows.map((row) => (
              <SwipeRow
                key={row.id}
                row={row}
                openRowId={openRowId}
                onOpenChange={setOpenRowId}
                onDetails={() => {
                  void details(row);
                }}
                onDelete={() => {
                  void remove(row);
                }}
                onSave={() => {
                  setRows((current) =>
                    current.map((item) =>
                      item.id === row.id ? { ...item, saved: !item.saved } : item,
                    ),
                  );
                  setOpenRowId(null);
                  setFeedback(row.saved ? `已取消收藏“${row.title}”` : `已收藏“${row.title}”`);
                }}
              />
            ))}
          </View>
          {!rows.length ? (
            <StatePanel state="empty" title="示例已全部删除" detail="点击右上方重置可以恢复。" />
          ) : null}
          {feedback ? <Body secondary>{feedback}</Body> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </View>
        <ReorderDemo onDraggingChange={setDragging} onInteract={() => setOpenRowId(null)} />
      </PageShell>
    </>
  );
}
