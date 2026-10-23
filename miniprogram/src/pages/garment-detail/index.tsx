import { useState } from 'react';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { errorMessage } from '../../shared/api/errors';
import { getAuthSession } from '../../shared/api/auth-token';
import { sessionQueryKey } from '../../shared/query/client';
import { changeGarmentStatus } from '../../features/wardrobe/queries';
import { WardrobePage } from '../../features/wardrobe/Page';
import { ConfirmDialog } from '../../features/wardrobe/ConfirmDialog';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { PrivatePhoto } from '../../features/wardrobe/PrivatePhoto';
import { Sheet, statusLabel } from '../../features/wardrobe/controls';
import { validUuid, wardrobeApi, type Garment } from '../../features/wardrobe/api';
import styles from '../../features/wardrobe/wardrobe.module.scss';

export default function GarmentDetailPage() {
  const session = useWardrobeSession();
  const id = useRouter().params.id;
  const [action, setAction] = useState<'archive' | 'restore' | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session),
  });
  const detail = useQuery({
    queryKey: sessionQueryKey(session, 'garment', id ?? ''),
    queryFn: ({ signal }) => wardrobeApi.garment(id!, signal),
    enabled: Boolean(session && validUuid(id)),
  });
  useDidShow(() => {
    if (session && validUuid(id)) void detail.refetch();
  });
  const mutation = useMutation({
    mutationFn: async (status: Garment['status']) => {
      if (!detail.data || !session || getAuthSession() !== session)
        throw new Error('请重新读取衣物');
      await changeGarmentStatus(session, detail.data, status);
    },
    onSuccess: () => {
      setAction(null);
      setWarning(null);
    },
    onError: (error) => setWarning(errorMessage(error)),
  });
  const garment = detail.data;
  const resolve = (
    group: 'categories' | 'colors' | 'seasons' | 'occasions',
    value: string | null | undefined,
  ) =>
    value ? (options.data?.[group].find((item) => item.id === value)?.label ?? value) : '未填写';
  const rows = garment
    ? [
        ['类别', resolve('categories', garment.category)],
        ['颜色', resolve('colors', garment.color)],
        [
          '适用季节',
          garment.season.map((value) => resolve('seasons', value)).join('、') || '未填写',
        ],
        [
          '场合',
          garment.occasion.map((value) => resolve('occasions', value)).join('、') || '未填写',
        ],
        ['标签', garment.tags.join('、') || '未填写'],
        ['备注', garment.notes ?? '未填写'],
      ]
    : [];
  return (
    <WardrobePage
      title="衣物详情"
      footer={
        session && garment ? (
          <Button
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/garment-form/index?id=' + garment.id });
            }}
          >
            编辑衣物
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
          <StatePanel state="error" title="衣物标识无效" />
        ) : detail.isPending ? (
          <StatePanel state="loading" title="正在读取衣物" />
        ) : detail.isError && !garment ? (
          <StatePanel
            state="error"
            title="衣物加载失败"
            detail={errorMessage(detail.error)}
            onRetry={() => {
              void detail.refetch();
            }}
          />
        ) : garment ? (
          <>
            <PrivatePhoto mediaId={garment.photo_media_id} detail />
            <View className={styles.detailHeading}>
              <Text className={styles.title}>{garment.name || '未命名衣物'}</Text>
              <Text className={styles.statusBadge}>{statusLabel(garment.status)}</Text>
            </View>
            {rows.map(([label, value]) => (
              <View className={styles.row} key={label}>
                <Text className={styles.caption}>{label}</Text>
                <Text className={styles.value}>{value}</Text>
              </View>
            ))}
            <View className={styles.detailStats}>
              <Text className={styles.label}>已记录穿着 {garment.wear_count} 次</Text>
              <Text className={styles.caption}>仅统计确认过的实际穿着</Text>
            </View>
            {warning || detail.isError ? (
              <>
                <Notice tone="error">{warning ?? errorMessage(detail.error)}</Notice>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void detail.refetch().then((result) => {
                      if (!result.isError) setWarning(null);
                    });
                  }}
                >
                  刷新衣物信息
                </Button>
              </>
            ) : null}
            {garment.status === 'archived' ? (
              <Button
                variant="secondary"
                loading={mutation.isPending}
                onClick={() => setAction('restore')}
              >
                恢复衣物
              </Button>
            ) : (
              <>
                <NativeButton
                  className={styles.detailAction}
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(garment.status === 'wearable' ? 'unavailable' : 'wearable')
                  }
                >
                  {garment.status === 'wearable' ? '设为暂不可穿' : '设为可穿'}
                  <Text>›</Text>
                </NativeButton>
                <NativeButton
                  className={styles.detailAction}
                  disabled={mutation.isPending}
                  onClick={() => setAction('archive')}
                >
                  归档衣物
                  <Text>›</Text>
                </NativeButton>
                <Text className={styles.caption}>归档后不参与推荐，已有穿着历史继续保留。</Text>
              </>
            )}
          </>
        ) : null}
      </View>
      {action === 'archive' && garment ? (
        <ConfirmDialog
          title="归档衣物"
          detail="归档后不参与推荐，衣物资料及已有穿着历史继续保留。"
          confirmLabel="确认归档"
          busy={mutation.isPending}
          error={warning}
          onConfirm={() => mutation.mutate('archived')}
          onCancel={() => setAction(null)}
        />
      ) : null}
      {action === 'restore' && garment ? (
        <Sheet title="恢复衣物" busy={mutation.isPending} onClose={() => setAction(null)}>
          <View className={styles.stack}>
            <Text>请选择恢复后的衣物状态。</Text>
            {warning ? <Notice tone="error">{warning}</Notice> : null}
            <>
              <Button loading={mutation.isPending} onClick={() => mutation.mutate('wearable')}>
                恢复为可穿
              </Button>
              <Button
                variant="secondary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate('unavailable')}
              >
                恢复为暂不可穿
              </Button>
            </>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              取消
            </Button>
          </View>
        </Sheet>
      ) : null}
    </WardrobePage>
  );
}
