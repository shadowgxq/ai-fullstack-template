import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { Text, View, Button as NativeButton } from '@tarojs/components';
import { Title, Body, Notice } from '../../shared/ui';
import { LibraryIcon } from './visuals';
import { readTouchPoint } from './gestures';
import { createGestureFrame } from './gesture-frame';
import {
  dragLayout,
  dragPosition,
  parseDragMetrics,
  reorderExamples,
  type DragMetric,
  type ReorderRow,
} from './interaction-model';
import styles from './gestures-demo.module.scss';

interface DragSession {
  id: string;
  startY: number;
  pointerY: number;
  touchOffset: number;
  original: ReorderRow[];
  preview: ReorderRow[];
  metrics: DragMetric[] | null;
}
export function ReorderDemo({
  onDraggingChange,
  onInteract,
}: {
  onDraggingChange: (value: boolean) => void;
  onInteract: () => void;
}) {
  const [rows, setRows] = useState<ReorderRow[]>(() => [...reorderExamples]);
  const [frame, setFrame] = useState<{ id: string; top: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const session = useRef<DragSession | null>(null);
  const [frames] = useState(() =>
    createGestureFrame((value: { current: DragSession; top: number; rows: ReorderRow[] }) => {
      if (session.current !== value.current) return;
      setRows((previous) =>
        previous.every((row, index) => row.id === value.rows[index].id) ? previous : value.rows,
      );
      setFrame((previous) =>
        previous?.id === value.current.id && previous.top === value.top
          ? previous
          : { id: value.current.id, top: value.top },
      );
    }),
  );
  useEffect(
    () => () => {
      frames.cancel();
      session.current = null;
    },
    [frames],
  );
  const update = (current: DragSession) => {
    if (!current.metrics) return;
    const next = dragPosition(
      current.preview,
      current.id,
      current.pointerY - current.touchOffset,
      current.metrics,
    );
    if (!next) return;
    current.preview = next.rows;
    frames.queue({ current, top: next.top, rows: next.rows });
  };
  const finish = (cancelled: boolean) => {
    const current = session.current;
    if (!current) return;
    frames.cancel();
    if (cancelled || !current.metrics) {
      setRows(current.original);
      if (cancelled) setAnnouncement('已取消排序');
    } else {
      setRows(current.preview);
      const title = current.preview.find((row) => row.id === current.id)?.title;
      setAnnouncement(
        `${title}已移到第 ${current.preview.findIndex((row) => row.id === current.id) + 1} 项`,
      );
    }
    session.current = null;
    setFrame(null);
    onDraggingChange(false);
  };
  // 拖动时只调整原生测量得到的位移，松手后再提交 DOM 顺序，保持触摸目标稳定。
  const current = session.current;
  const renderRows = current?.original ?? rows;
  const layout = current?.metrics ? dragLayout(rows, current.metrics) : null;
  return (
    <View className={styles.section}>
      <View className={styles.sectionHeader}>
        <Title section>拖动排序 · Reorder</Title>
        <NativeButton
          className={styles.reset}
          onClick={(event) => {
            event.stopPropagation();
            onInteract();
            if (!session.current) {
              setRows([...reorderExamples]);
              setAnnouncement('已恢复默认顺序');
              setError(null);
            }
          }}
        >
          重置
        </NativeButton>
      </View>
      <Body secondary>按住右侧手柄上下拖动，松手完成排序。</Body>
      <View className={styles.sortList} id="reorder-list">
        {renderRows.map((row) => {
          const active = frame?.id === row.id;
          const origin = current?.metrics?.find((item) => item.id === row.id);
          const slot = layout?.find((item) => item.id === row.id);
          const offset = origin && slot ? (active ? frame.top : slot.top) - origin.top : 0;
          return (
            <View
              key={row.id}
              id={`sort-${row.id}`}
              className={`reorder-row ${styles.sortRow} ${active ? styles.dragging : frame ? styles.shifting : ''}`}
              style={frame ? { transform: `translate3d(0,${offset}px,0)` } : undefined}
            >
              <Text className={styles.order}>
                {rows.findIndex((item) => item.id === row.id) + 1}
              </Text>
              <View className={styles.rowCopy}>
                <Text className={styles.rowTitle}>{row.title}</Text>
                <Text className={styles.rowDescription}>{row.detail}</Text>
              </View>
              <View
                className={styles.grip}
                catchMove
                ariaRole="button"
                ariaLabel={`拖动${row.title}排序`}
                onClick={(event) => event.stopPropagation()}
                onTouchStart={(event) => {
                  event.stopPropagation();
                  const point = readTouchPoint(event, 'touches');
                  if (!point || session.current) return;
                  onInteract();
                  setError(null);
                  onDraggingChange(true);
                  const current: DragSession = {
                    id: row.id,
                    startY: point.clientY,
                    pointerY: point.clientY,
                    touchOffset: 0,
                    original: [...rows],
                    preview: [...rows],
                    metrics: null,
                  };
                  session.current = current;
                  // 使用本次原生测量的行高与间距，避免把示意稿的固定高度用于拖动计算。
                  try {
                    Taro.createSelectorQuery()
                      .selectAll('#reorder-list .reorder-row')
                      .boundingClientRect((raw) => {
                        if (session.current !== current) return;
                        const metrics = parseDragMetrics(
                          raw,
                          current.original.map((item) => item.id),
                        );
                        const measured = metrics?.find((item) => item.id === current.id);
                        if (!metrics || !measured) {
                          setError('暂时无法开始拖动，请重试');
                          finish(true);
                          return;
                        }
                        current.metrics = metrics;
                        current.touchOffset = current.startY - measured.top;
                        update(current);
                      })
                      .exec();
                  } catch {
                    setError('暂时无法开始拖动，请重试');
                    finish(true);
                  }
                }}
                onTouchMove={(event) => {
                  event.stopPropagation();
                  const point = readTouchPoint(event, 'touches');
                  if (point && session.current) {
                    session.current.pointerY = point.clientY;
                    update(session.current);
                  }
                }}
                onTouchEnd={(event) => {
                  event.stopPropagation();
                  const point = readTouchPoint(event, 'changedTouches');
                  if (point && session.current) {
                    session.current.pointerY = point.clientY;
                    update(session.current);
                  }
                  finish(false);
                }}
                onTouchCancel={(event) => {
                  event.stopPropagation();
                  finish(true);
                }}
              >
                <LibraryIcon name="grip" tone="muted" />
              </View>
            </View>
          );
        })}
      </View>
      {announcement ? <Body secondary>{announcement}</Body> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </View>
  );
}
