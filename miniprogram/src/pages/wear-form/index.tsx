import { useEffect, useRef, useState } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { ApiError, errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../../features/wardrobe/Page';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { validUuid, wardrobeApi } from '../../features/wardrobe/api';
import { RecordItem } from '../../features/wear-history/RecordItems';
import { GarmentPicker } from '../../features/wear-history/GarmentPicker';
import { WearForm, WearGarmentPreview } from '../../features/wear-history/WearForm';
import { emptyWearDraft, type WearDraft } from '../../features/wear-history/draft';
import { recommendedWearDraft } from '../../features/outfits/wear-prefill';
import { draftFromWear, type WearRecord } from '../../features/wear-history/api';
import { WearEditor } from '../../features/wear-history/editor';
import { returnAfterWearSave } from '../../features/wear-history/navigation';
import { invalidateWearFacts, wearRecordQueryOptions } from '../../features/wear-history/queries';
import styles from '../../features/wear-history/wear-history.module.scss';

function CurrentGarmentPreview({ id }: { id: string }) {
  const session = useWardrobeSession();
  const garment = useQuery({
    queryKey: sessionQueryKey(session, 'garment', id),
    queryFn: ({ signal }) => wardrobeApi.garment(id, signal),
    enabled: Boolean(session),
  });
  return garment.data ? (
    <WearGarmentPreview
      garmentId={id}
      name={garment.data.name}
      photoMediaId={garment.data.photo_media_id}
    />
  ) : (
    <View>
      <Text className={styles.caption}>
        {garment.isError ? '衣物资料读取失败，保存前请核对' : '读取衣物资料'}
      </Text>
      {garment.isError ? (
        <Button
          variant="secondary"
          onClick={() => {
            void garment.refetch();
          }}
        >
          重试衣物资料
        </Button>
      ) : null}
    </View>
  );
}
function FormContent({
  session,
  initial,
  prefill,
}: {
  session: AuthSession;
  initial?: WearRecord;
  prefill?: WearDraft;
}) {
  const [draft, setDraft] = useState(() =>
    initial ? draftFromWear(initial) : (prefill ?? emptyWearDraft()),
  );
  const [editor] = useState(() => new WearEditor(session, initial));
  const [original] = useState(() => new Map(initial?.items.map((item) => [item.garment_id, item])));
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const lifetime = useRef(new AbortController());
  const lock = useRef(false);
  useEffect(() => () => lifetime.current.abort(), []);
  const active = () => !lifetime.current.signal.aborted && getAuthSession() === session;
  const navigateAfterSave = async () => {
    try {
      await returnAfterWearSave(active);
    } catch {
      if (active()) setError('记录已保存，页面暂时无法打开，请点击下方按钮重试返回');
    }
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      await editor.save(draft, lifetime.current.signal);
      if (!active()) return;
      setSaved(true);
      setUncertain(false);
      await invalidateWearFacts(session).catch(() => undefined);
      if (active()) await navigateAfterSave();
    } catch (error) {
      if (active()) {
        setUncertain(editor.uncertain);
        setConflict(error instanceof ApiError && error.status === 409);
        setError(
          draft.recommendationRequestId && error instanceof ApiError && error.code === 40982
            ? '这次建议的依据已变化。日期和衣物已保留，请重新生成建议，或明确改为手动补录。'
            : error instanceof ApiError && error.status === 409
              ? '记录已更新或操作冲突，请核对最新记录；当前输入已保留'
              : errorMessage(error),
        );
      }
    } finally {
      lock.current = false;
      if (active()) setSaving(false);
    }
  };
  return (
    <WardrobePage
      title={initial ? '修改穿着记录' : draft.recommendationRequestId ? '确认实际穿着' : '记录穿着'}
      footer={
        <Button
          loading={saving}
          onClick={() => {
            void save();
          }}
        >
          {saved ? '返回记录' : uncertain ? '重试确认上次保存' : initial ? '保存修改' : '确认记录'}
        </Button>
      }
    >
      {uncertain ? <Notice>上次保存结果尚未确认，请先重试原操作；日期和衣物已保留。</Notice> : null}
      {draft.recommendationRequestId ? (
        <View className={styles.body}>
          <Notice>已带入这次建议。请核对实际穿着日期和衣物，保存时会再次检查建议是否有效。</Notice>
          <Button
            variant="secondary"
            disabled={saving || uncertain || saved}
            onClick={() => {
              setDraft(({ wearDate, garmentIds }) => ({ wearDate, garmentIds }));
              setError(null);
            }}
          >
            改为手动补录
          </Button>
        </View>
      ) : null}
      {conflict && initial ? (
        <View className={styles.body}>
          <Button
            variant="secondary"
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/wear-detail/index?id=' + initial.id });
            }}
          >
            核对最新记录
          </Button>
        </View>
      ) : null}
      <WearForm
        draft={draft}
        onChange={setDraft}
        onAdjust={() => setSelectionOpen(true)}
        disabled={saving || uncertain || saved}
        error={error}
      >
        {draft.garmentIds.map((id) =>
          original.has(id) ? (
            <RecordItem key={id} item={original.get(id)!} />
          ) : (
            <CurrentGarmentPreview key={id} id={id} />
          ),
        )}
      </WearForm>
      {selectionOpen ? (
        <GarmentPicker
          session={session}
          initialIds={draft.garmentIds}
          onApply={(garmentIds) => {
            setDraft((current) => ({ ...current, garmentIds }));
            setSelectionOpen(false);
          }}
          onCancel={() => setSelectionOpen(false)}
        />
      ) : null}
    </WardrobePage>
  );
}
export default function WearFormPage() {
  const session = useWardrobeSession();
  const params = useRouter().params;
  const id = params.id ?? '';
  const recommendation = params.recommendation ?? '';
  const prefill = session && recommendation ? recommendedWearDraft(session, recommendation) : null;
  const record = useQuery(wearRecordQueryOptions(session, validUuid(id) ? id : ''));
  if (!session)
    return (
      <WardrobePage title="记录穿着">
        <StatePanel state="empty" title="请先微信登录" />
        <Button
          onClick={() => {
            void Taro.navigateTo({ url: '/pages/login/index' });
          }}
        >
          微信登录
        </Button>
      </WardrobePage>
    );
  if (id && !validUuid(id))
    return (
      <WardrobePage title="修改穿着记录">
        <StatePanel state="error" title="穿着记录标识无效" />
      </WardrobePage>
    );
  if (recommendation && (!prefill || id))
    return (
      <WardrobePage title="确认实际穿着">
        <StatePanel
          state="empty"
          title="这次穿搭草稿已不可用"
          detail="请回穿搭页重新核对建议，或从记录页手动补录。"
        />
        <Button
          onClick={() => {
            void Taro.redirectTo({ url: '/pages/outfits/index' });
          }}
        >
          返回穿搭
        </Button>
      </WardrobePage>
    );
  if (id && !record.data)
    return (
      <WardrobePage title="修改穿着记录">
        {record.isError ? (
          <StatePanel
            state="error"
            title="记录加载失败"
            detail={errorMessage(record.error)}
            onRetry={() => {
              void record.refetch();
            }}
          />
        ) : (
          <StatePanel state="loading" title="正在读取记录" />
        )}
      </WardrobePage>
    );
  return (
    <FormContent
      key={session.generation + ':' + (id || recommendation || 'new')}
      session={session}
      initial={record.data}
      prefill={prefill ?? undefined}
    />
  );
}
