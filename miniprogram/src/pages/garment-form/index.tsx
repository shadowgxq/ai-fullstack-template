import { useEffect, useRef, useState } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { ApiError, errorMessage } from '../../shared/api/errors';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { sessionQueryKey } from '../../shared/query/client';
import { invalidateGarmentFacts } from '../../features/wardrobe/queries';
import { chooseImage } from '../../shared/platform/wechat';
import { openWardrobe, WardrobePage } from '../../features/wardrobe/Page';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { GarmentForm } from '../../features/wardrobe/GarmentForm';
import {
  draftFromGarment,
  garmentInput,
  validUuid,
  wardrobeApi,
  type Garment,
  type GarmentInput,
  type WardrobeOptions,
} from '../../features/wardrobe/api';
import {
  emptyGarmentDraft,
  newOperationKey,
  PendingCreate,
  validateGarmentDraft,
} from '../../features/wardrobe/draft';

function FormEditor({
  session,
  initial,
  options,
}: {
  session: AuthSession;
  initial?: Garment;
  options: WardrobeOptions;
}) {
  const [draft, setDraft] = useState(() =>
    initial ? draftFromGarment(initial) : emptyGarmentDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const completedId = useRef<string | null>(null);
  const attempt = useRef(new PendingCreate<GarmentInput>());
  const upload = useRef<{ path: string; key: string } | null>(null);
  const lifetime = useRef(new AbortController());
  const saveLock = useRef(false);
  const photoLock = useRef(false);
  const selectionLock = useRef(false);
  const pendingPatch = useRef<{ payload: GarmentInput; uncertain: boolean } | null>(null);
  // 保留用户开始编辑时的版本，后台重读不得悄悄把旧草稿升级为新版本写入。
  const baseVersion = useRef(initial?.version);
  useEffect(() => () => lifetime.current.abort(), []);
  const active = () => !lifetime.current.signal.aborted && getAuthSession() === session;
  const uploadPhoto = async () => {
    if (!upload.current || photoLock.current) return;
    photoLock.current = true;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const media = await wardrobeApi.upload(
        upload.current.path,
        upload.current.key,
        lifetime.current.signal,
      );
      if (active()) setDraft((value) => ({ ...value, photoMediaId: media.id }));
    } catch (error) {
      if (active()) setPhotoError(errorMessage(error));
    } finally {
      photoLock.current = false;
      if (active()) setPhotoBusy(false);
    }
  };
  const selectPhoto = async (source: 'camera' | 'album') => {
    if (photoLock.current || selectionLock.current || saving || uncertain) return;
    selectionLock.current = true;
    setPhotoBusy(true);
    try {
      const path = await chooseImage(source);
      if (!path || !active()) return;
      upload.current = { path, key: newOperationKey() };
      setPhotoPreview(path);
      setPhotoError(null);
      setDraft((value) => ({ ...value, photoMediaId: null }));
      await uploadPhoto();
    } catch (error) {
      if (active()) setPhotoError(errorMessage(error));
    } finally {
      selectionLock.current = false;
      if (active()) setPhotoBusy(false);
    }
  };
  const navigateAfterSave = async (id: string) => {
    if (!active()) return;
    try {
      if (initial)
        await Taro.navigateBack().catch(() =>
          Taro.redirectTo({ url: '/pages/garment-detail/index?id=' + encodeURIComponent(id) }),
        );
      else await openWardrobe();
    } catch {
      if (active()) setSaveError('衣物已保存，页面暂时无法打开，请点击下方按钮重试返回');
    }
  };
  const finish = async (id: string) => {
    if (!active()) return;
    // 写入已经成功；后续缓存刷新或导航失败只能重试返回，不能再次提交衣物。
    completedId.current = id;
    setSaved(true);
    attempt.current.complete();
    pendingPatch.current = null;
    setUncertain(false);
    await invalidateGarmentFacts(session, id).catch(() => undefined);
    await navigateAfterSave(id);
  };
  const save = async () => {
    if (saveLock.current || photoBusy) return;
    if (completedId.current) {
      saveLock.current = true;
      setSaving(true);
      setSaveError(null);
      try {
        await navigateAfterSave(completedId.current);
      } finally {
        saveLock.current = false;
        if (active()) setSaving(false);
      }
      return;
    }
    const validation = validateGarmentDraft(draft);
    if (validation) {
      setSaveError(validation);
      return;
    }
    if (upload.current && !draft.photoMediaId) {
      setSaveError('请先完成照片上传，或移除照片后保存');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    const payload = garmentInput(draft);
    try {
      if (initial) {
        if (pendingPatch.current?.uncertain) {
          const latest = await wardrobeApi.garment(initial.id, lifetime.current.signal);
          if (
            JSON.stringify(garmentInput(draftFromGarment(latest))) ===
            JSON.stringify(pendingPatch.current.payload)
          ) {
            await finish(initial.id);
            return;
          }
          if (latest.version !== baseVersion.current)
            throw new ApiError('衣物已被修改，请核对最新详情；当前输入已保留', 'http', 409);
        }
        pendingPatch.current = { payload, uncertain: false };
        await wardrobeApi.patch(
          initial.id,
          { ...payload, expected_version: baseVersion.current! },
          lifetime.current.signal,
        );
        await finish(initial.id);
      } else {
        const operation = attempt.current.begin(payload);
        const result = await wardrobeApi.create(
          operation.payload,
          operation.key,
          lifetime.current.signal,
        );
        await finish(result.id);
      }
    } catch (error) {
      if (initial && pendingPatch.current)
        pendingPatch.current.uncertain = !(
          error instanceof ApiError &&
          error.kind === 'http' &&
          (error.status ?? 500) < 500
        );
      if (!initial) attempt.current.failed(error);
      if (active()) {
        setUncertain(
          initial ? Boolean(pendingPatch.current?.uncertain) : attempt.current.uncertain,
        );
        setSaveError(
          error instanceof ApiError && error.status === 409
            ? '衣物已更新或操作发生冲突，请核对最新详情；当前输入已保留'
            : errorMessage(error),
        );
      }
    } finally {
      saveLock.current = false;
      if (active()) setSaving(false);
    }
  };
  return (
    <WardrobePage
      title={initial ? '编辑衣物' : '添加衣物'}
      footer={
        <Button
          loading={saving}
          disabled={photoBusy}
          onClick={() => {
            void save();
          }}
        >
          {saved
            ? initial
              ? '返回衣物详情'
              : '返回衣柜'
            : uncertain
              ? '重试确认上次保存'
              : initial
                ? '保存修改'
                : '添加到衣柜'}
        </Button>
      }
    >
      {uncertain ? <Notice>上次保存结果尚未确认，请先重试原操作；已填写内容保留。</Notice> : null}
      <GarmentForm
        draft={draft}
        onChange={setDraft}
        categories={options.categories}
        colors={options.colors}
        seasons={options.seasons}
        occasions={options.occasions}
        tagSuggestions={options.styles}
        disabled={saving || uncertain || saved}
        photoBusy={photoBusy}
        photoPreview={photoPreview}
        photoError={photoError}
        onPhoto={(source) => {
          void selectPhoto(source);
        }}
        onRemovePhoto={() => {
          upload.current = null;
          setPhotoPreview(null);
          setPhotoError(null);
          setDraft((value) => ({ ...value, photoMediaId: null }));
        }}
        onRetryPhoto={() => {
          void uploadPhoto();
        }}
        error={saveError}
      />
    </WardrobePage>
  );
}
export default function GarmentFormPage() {
  const session = useWardrobeSession();
  const id = useRouter().params.id;
  const isEditing = Boolean(id);
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session),
  });
  const garment = useQuery({
    queryKey: sessionQueryKey(session, 'garment', id ?? ''),
    queryFn: ({ signal }) => wardrobeApi.garment(id!, signal),
    enabled: Boolean(session && id && validUuid(id)),
  });
  if (!session)
    return (
      <WardrobePage title="添加衣物">
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
  if (isEditing && !validUuid(id))
    return (
      <WardrobePage title="编辑衣物">
        <StatePanel state="error" title="衣物标识无效" />
      </WardrobePage>
    );
  if ((options.isError && !options.data) || (garment.isError && !garment.data))
    return (
      <WardrobePage title={isEditing ? '编辑衣物' : '添加衣物'}>
        <StatePanel
          state="error"
          title="衣物资料加载失败"
          detail={errorMessage(options.error ?? garment.error)}
          onRetry={() => {
            void options.refetch();
            if (id) void garment.refetch();
          }}
        />
      </WardrobePage>
    );
  if (!options.data || (isEditing && !garment.data))
    return (
      <WardrobePage title={isEditing ? '编辑衣物' : '添加衣物'}>
        <StatePanel state="loading" title="正在加载衣物资料" />
      </WardrobePage>
    );
  return (
    <FormEditor
      key={session.generation + ':' + (id ?? 'new')}
      session={session}
      initial={garment.data}
      options={options.data}
    />
  );
}
