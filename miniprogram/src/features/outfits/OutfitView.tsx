import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { PrivatePhoto } from '../wardrobe/PrivatePhoto';
import { WardrobeEmptyState } from '../wardrobe/EmptyState';
import { scenes } from './api';
import { canConfirm, generating, type OutfitState } from './session';
import styles from './outfits.module.scss';
import { WardrobeIcon } from '../wardrobe/Icon';
import type { Choice } from '../wardrobe/controls';

export function OutfitActions({
  state,
  onGenerate,
  onCancel,
  onConfirm,
}: {
  state: OutfitState;
  onGenerate: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const pending = generating(state.view);
  return (
    <View className={styles.actions}>
      <Button
        variant="secondary"
        loading={state.creating || state.cancelling}
        onClick={pending ? onCancel : onGenerate}
      >
        <WardrobeIcon name="shuffle" />
        {state.cancelling
          ? '取消中'
          : pending
            ? '取消生成'
            : state.uncertain
              ? '重试上次生成'
              : state.view
                ? '换一套'
                : '生成穿搭'}
      </Button>
      <Button disabled={!canConfirm(state)} onClick={onConfirm}>
        <WardrobeIcon name="clipboard" />
        记录今天穿着
      </Button>
    </View>
  );
}
export function OutfitResult({
  state,
  onReplace,
  onRetry,
  onRetrySelection,
  onAdd,
  onPreferences,
  categories = [],
}: {
  state: OutfitState;
  onReplace: (id: string) => void;
  onRetry: () => void;
  onRetrySelection: () => void;
  onAdd: () => void;
  onPreferences: () => void;
  categories?: readonly Choice[];
}) {
  const view = state.view;
  return (
    <View className={styles.result}>
      {state.error ? (
        <>
          <Notice tone="error">{state.error}</Notice>
          {view ? (
            <Button variant="secondary" loading={state.refreshing} onClick={onRetry}>
              重试读取建议
            </Button>
          ) : null}
        </>
      ) : null}
      {state.uncertain ? (
        <Notice>上次生成结果尚未确认，请重试上次请求；本次场景与天气选择已保留。</Notice>
      ) : null}
      {state.creating || generating(view) ? (
        <StatePanel
          state="loading"
          title="正在准备穿搭建议"
          detail="离开页面后可回来继续查看，也可以主动取消生成。"
        />
      ) : null}
      {!view && !state.creating ? (
        <StatePanel
          state="empty"
          title="今天想怎么穿？"
          detail="选择本次场景，结合衣柜生成建议；天气或历史缺失时也可以继续。"
        />
      ) : null}
      {view?.status === 'failed' ? (
        <StatePanel
          state="error"
          title="这次建议未能完成"
          detail="可以重新生成一套。已有衣物和穿着记录不受影响。"
        />
      ) : null}
      {view?.status === 'cancelled' ? (
        <StatePanel state="empty" title="已取消这次生成" detail="需要时可以重新生成穿搭。" />
      ) : null}
      {view?.status === 'stale' ? (
        <StatePanel
          state="empty"
          title="这次建议的依据已变化"
          detail={
            view.error_code === 'weather_expired'
              ? '使用的天气已过期，请重新生成。'
              : '衣柜、偏好或记录已有变化，请重新生成。'
          }
        />
      ) : null}
      {view?.status === 'ready' && view.outcome !== 'recommendation' ? (
        <WardrobeEmptyState
          kind="outfit"
          presentation="inline"
          title={view.outcome === 'no_candidates' ? '暂时没有合适的推荐单品' : undefined}
          detail={
            view.outcome === 'no_candidates'
              ? '当前可穿衣物未满足已设置的条件，可管理衣柜或调整偏好。'
              : undefined
          }
          actionLabel={view.outcome === 'no_candidates' ? '管理衣柜' : undefined}
          onAction={onAdd}
          secondaryAction={
            view.outcome === 'no_candidates'
              ? { label: '调整穿搭偏好', onClick: onPreferences }
              : undefined
          }
        />
      ) : null}
      {view?.status === 'ready' && view.outcome === 'recommendation' ? (
        <>
          <View className={styles.resultHeading}>
            <Text className={styles.title}>今天可以这样穿</Text>
            <Text className={styles.caption}>
              本次建议：{scenes.find((scene) => scene.id === view.scene)?.label} · 点击单品替换
            </Text>
          </View>
          <View className={styles.garments}>
            {state.garments.map((item) => (
              <NativeButton
                key={item.id}
                className={styles.garment}
                disabled={state.cancelling}
                onClick={() => onReplace(item.id)}
              >
                <View className={styles.garmentPhoto}>
                  <PrivatePhoto mediaId={item.photo_media_id} />
                  <View className={styles.replaceMark}>
                    <WardrobeIcon name="arrow-left-right" />
                  </View>
                </View>
                <Text className={styles.garmentName}>{item.name || '未命名衣物'}</Text>
                <Text className={styles.caption}>
                  {categories.find((category) => category.id === item.category)?.label ??
                    (item.category || '未分类')}
                </Text>
              </NativeButton>
            ))}
          </View>
          {state.checking ? <Notice>正在核对完整组合，确认后再展示搭配依据。</Notice> : null}
          {state.selectionError ? (
            <>
              <Notice tone="error">
                {state.selectionError}。当前选择已保留，请重试或重新选择单品。
              </Notice>
              <Button variant="secondary" onClick={onRetrySelection}>
                重试校验当前组合
              </Button>
            </>
          ) : null}
          {state.selection && !state.checking ? (
            <View className={styles.reasons}>
              <View className={styles.reasonHeading}>
                <WardrobeIcon name="sparkles" tone="primary" />
                <Text className={styles.heading}>为什么推荐这套？</Text>
              </View>
              <View className={styles.reasonList}>
                {state.selection.reasons.map((reason, i) => (
                  <View className={styles.reasonRow} key={i}>
                    <View className={styles.reasonIcon}>
                      <WardrobeIcon
                        name={
                          reason.includes('天气')
                            ? 'cloud-sun'
                            : reason.includes('偏好')
                              ? 'sliders-horizontal'
                              : reason.includes('穿着')
                                ? 'history'
                                : 'check'
                        }
                        tone="primary"
                      />
                    </View>
                    <Text className={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
              {state.selection.limitations.map((limitation, i) => (
                <Text className={styles.caption} key={i}>
                  {limitation}
                </Text>
              ))}
              <Text className={styles.caption}>建议仅供参考，请结合实际体感调整。</Text>
            </View>
          ) : null}
        </>
      ) : null}
      {view ? (
        <>
          {view.candidate_scope_limited ? (
            <Notice>
              这次生成只考虑了部分合规衣物（共 {view.eligible_count}{' '}
              件合规衣物），并未比较所有组合。
            </Notice>
          ) : null}
          {(view.status === 'ready' && view.outcome === 'recommendation'
            ? []
            : view.limitations
          ).map((limitation, i) => (
            <Text className={styles.caption} key={i}>
              {limitation}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}
