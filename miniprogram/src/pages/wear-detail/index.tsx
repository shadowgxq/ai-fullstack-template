import { useEffect, useRef, useState } from 'react';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { abortError, errorMessage } from '../../shared/api/errors';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { WardrobePage } from '../../features/wardrobe/Page';
import { validUuid } from '../../features/wardrobe/api';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { RecordItem } from '../../features/wear-history/RecordItems';
import { ConfirmDialog } from '../../features/wardrobe/ConfirmDialog';
import { wearApi } from '../../features/wear-history/api';
import { invalidateWearFacts, wearRecordQueryOptions } from '../../features/wear-history/queries';
import styles from '../../features/wear-history/wear-history.module.scss';

export default function WearDetailPage() {
  const session = useWardrobeSession();
  const id = useRouter().params.id ?? '';
  return (
    <DetailContent
      key={(session?.generation ?? 'anonymous') + ':' + id}
      session={session}
      id={id}
    />
  );
}
function DetailContent({ session, id }: { session: AuthSession | null; id: string }) {
  const lifetime = useRef(new AbortController());
  useEffect(() => () => lifetime.current.abort(), []);
  const active = () =>
    !lifetime.current.signal.aborted && session !== null && getAuthSession() === session;
  const record = useQuery(wearRecordQueryOptions(session, validUuid(id) ? id : ''));
  const [confirm, setConfirm] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [deleteVersion, setDeleteVersion] = useState<number | null>(null);
  useDidShow(() => {
    if (session && validUuid(id) && !deleted) void record.refetch();
  });
  const back = async () => {
    if (!active()) return;
    try {
      await Taro.redirectTo({ url: '/pages/wear-history/index' });
    } catch {
      if (active()) setWarning('记录已删除，页面暂时无法打开，请重试返回');
    }
  };
  const deletion = useMutation({
    mutationFn: () => {
      if (!active() || deleteVersion === null) throw abortError();
      return wearApi.remove(id, deleteVersion, lifetime.current.signal);
    },
    onSuccess: async () => {
      if (!session || getAuthSession() !== session) return;
      setDeleted(true);
      setConfirm(false);
      await invalidateWearFacts(session).catch(() => undefined);
      if (active()) await back();
    },
  });
  return (
    <WardrobePage
      title="穿着记录详情"
      footer={
        session && record.data && !deleted ? (
          <Button
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/wear-form/index?id=' + id });
            }}
          >
            修改记录
          </Button>
        ) : undefined
      }
    >
      <View className={styles.body}>
        {!session ? (
          <>
            <StatePanel state="empty" title="请先微信登录" />
            <Button
              onClick={() => {
                void Taro.navigateTo({ url: '/pages/login/index' });
              }}
            >
              微信登录
            </Button>
          </>
        ) : !validUuid(id) ? (
          <StatePanel state="error" title="穿着记录标识无效" />
        ) : deleted ? (
          <>
            <Notice>记录已删除，衣柜中的衣物继续保留。</Notice>
            {warning ? <Notice tone="error">{warning}</Notice> : null}
            <Button
              onClick={() => {
                void back();
              }}
            >
              返回记录
            </Button>
          </>
        ) : record.isPending ? (
          <StatePanel state="loading" title="正在读取记录" />
        ) : record.isError && !record.data ? (
          <StatePanel
            state="error"
            title="记录加载失败"
            detail={errorMessage(record.error)}
            onRetry={() => {
              void record.refetch();
            }}
          />
        ) : record.data ? (
          <>
            <Text className={styles.heading}>{record.data.wear_date}</Text>
            <Text className={styles.caption}>实际穿着 · {record.data.items.length} 件衣物</Text>
            <View className={styles.previewGrid}>
              {record.data.items.map((item) => (
                <RecordItem key={item.garment_id} item={item} />
              ))}
            </View>
            <Text className={styles.caption}>
              名称与类别为保存时的记录；照片展示当前衣物。每件衣物在这条记录中计 1 次。
            </Text>
            {record.isError ? <Notice tone="error">{errorMessage(record.error)}</Notice> : null}
            <Button
              variant="secondary"
              onClick={() => {
                void record.refetch();
              }}
            >
              刷新记录
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteVersion(record.data!.version);
                deletion.reset();
                setConfirm(true);
              }}
            >
              删除记录
            </Button>
          </>
        ) : null}
      </View>
      {confirm ? (
        <ConfirmDialog
          title="删除穿着记录"
          detail="删除后，这条穿着记录及其对应计数将移除，衣柜中的衣物仍会保留。"
          confirmLabel="删除记录"
          danger
          busy={deletion.isPending}
          error={deletion.isError ? errorMessage(deletion.error) : null}
          onConfirm={() => deletion.mutate()}
          onCancel={() => {
            setConfirm(false);
            deletion.reset();
          }}
        />
      ) : null}
    </WardrobePage>
  );
}
