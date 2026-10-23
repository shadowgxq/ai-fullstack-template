import { useEffect, useRef, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { ApiError, errorMessage, isRecord } from '../../shared/api/errors';
import { queryClient, sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../../features/wardrobe/Page';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { wardrobeApi, type WardrobeOptions } from '../../features/wardrobe/api';
import {
  preferencesApi,
  draftFromPreferences,
  preferenceFields,
  type Preferences,
} from '../../features/wardrobe-preferences/api';
import { PreferencesEditor } from '../../features/wardrobe-preferences/editor';
import {
  validatePreferencesDraft,
  type PreferencesErrors,
} from '../../features/wardrobe-preferences/draft';
import {
  preferencesQueryOptions,
  refreshPreferences,
} from '../../features/wardrobe-preferences/queries';
import { PreferencesForm } from '../../features/wardrobe-preferences/PreferencesForm';
import { PreferencesSummary } from '../../features/wardrobe-preferences/PreferencesSummary';
import { returnAfterPreferencesSave } from '../../features/wardrobe-preferences/navigation';
import styles from '../../features/wardrobe-preferences/preferences.module.scss';

function PreferencesContent({
  session,
  initial,
  options,
}: {
  session: AuthSession;
  initial: Preferences;
  options: WardrobeOptions;
}) {
  const [draft, setDraft] = useState(() => draftFromPreferences(initial));
  const [editor] = useState(() => new PreferencesEditor(session, initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<PreferencesErrors>({});
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<Preferences | null>(null);
  const [reading, setReading] = useState(false);
  const lifetime = useRef(new AbortController());
  const lock = useRef(false);
  const readLock = useRef(false);
  useEffect(
    () => () => {
      lifetime.current.abort();
      editor.close();
    },
    [editor],
  );
  const active = () => !lifetime.current.signal.aborted && getAuthSession() === session;
  const errors = { ...validatePreferencesDraft(draft, options), ...serverErrors };
  const returnSaved = async () => {
    try {
      await returnAfterPreferencesSave(active);
    } catch {
      if (active()) setError('偏好已保存，暂时无法返回设置，请重试返回');
    }
  };
  const save = async () => {
    if (!active() || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      if (editor.saved) {
        await returnSaved();
        return;
      }
      if (!editor.uncertain && Object.keys(errors).length) {
        setError('请调整下方标记的偏好后再保存');
        return;
      }
      setError(null);
      setConflict(false);
      const result = await editor.save(draft, lifetime.current.signal);
      if (!active()) return;
      setSaved(true);
      setUncertain(false);
      await refreshPreferences(session, result).catch(() => undefined);
      if (active()) await returnSaved();
    } catch (error) {
      if (!active()) return;
      setUncertain(editor.uncertain);
      setConflict(error instanceof ApiError && error.status === 409);
      setError(
        error instanceof ApiError && error.status === 409
          ? '偏好已更新，请核对最新偏好；当前选择已保留'
          : errorMessage(error),
      );
      if (error instanceof ApiError && error.status === 422 && Array.isArray(error.details)) {
        const fields: PreferencesErrors = {};
        for (const issue of error.details)
          if (isRecord(issue) && Array.isArray(issue.loc)) {
            for (const [field, dtoField] of Object.entries(preferenceFields))
              if (issue.loc.includes(dtoField))
                fields[field as keyof typeof preferenceFields] =
                  '该组选择不符合要求，请核对喜欢与避免项';
            if (issue.loc.includes('comfort_notes'))
              fields.comfortNotes = '舒适度要求最多填写500个字符';
          }
        setServerErrors(fields);
      }
    } finally {
      lock.current = false;
      if (active()) setSaving(false);
    }
  };
  const readLatest = async () => {
    if (!active() || readLock.current) return;
    readLock.current = true;
    setReading(true);
    try {
      const value = await preferencesApi.read(lifetime.current.signal);
      if (!active()) return;
      setLatest(value);
      queryClient.setQueryData(sessionQueryKey(session, 'preferences'), value);
    } catch (error) {
      if (active()) setError(errorMessage(error));
    } finally {
      readLock.current = false;
      if (active()) setReading(false);
    }
  };
  return (
    <WardrobePage
      title="穿搭偏好"
      footer={
        <Button
          loading={saving}
          onClick={() => {
            void save();
          }}
        >
          {saved ? '重试返回设置' : uncertain ? '重试确认上次保存' : '保存偏好'}
        </Button>
      }
    >
      {error || uncertain || conflict ? (
        <View className={styles.feedback}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {uncertain ? (
            <Notice>上次保存结果尚未确认，请先重试原操作；所有选择已保留。</Notice>
          ) : null}
          {conflict ? (
            <>
              <Notice>
                当前选择与舒适度原文已保留。核对最新偏好后，可返回设置再重新进入编辑；不会自动覆盖本次输入。
              </Notice>
              <Button
                variant="secondary"
                loading={reading}
                onClick={() => {
                  void readLatest();
                }}
              >
                读取最新偏好
              </Button>
            </>
          ) : null}
        </View>
      ) : null}
      {latest ? <PreferencesSummary value={latest} options={options} /> : null}
      <PreferencesForm
        draft={draft}
        options={options}
        errors={errors}
        disabled={saving || uncertain || saved}
        onChange={(next) => {
          if (active() && !lock.current && !uncertain && !saved) {
            setDraft(next);
            setServerErrors({});
            setError(null);
          }
        }}
      />
    </WardrobePage>
  );
}
export default function WardrobePreferencesPage() {
  const session = useWardrobeSession();
  const preferences = useQuery(preferencesQueryOptions(session));
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
    enabled: Boolean(session),
  });
  useDidShow(() => {
    if (session) {
      void preferences.refetch();
      void options.refetch();
    }
  });
  if (!session)
    return (
      <WardrobePage title="穿搭偏好">
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
  if (!preferences.data || !options.data)
    return (
      <WardrobePage title="穿搭偏好">
        {preferences.isError || options.isError ? (
          <StatePanel
            state="error"
            title="偏好读取失败"
            detail={errorMessage(preferences.error ?? options.error)}
            onRetry={() => {
              void preferences.refetch();
              void options.refetch();
            }}
          />
        ) : (
          <StatePanel state="loading" title="正在读取偏好与选项" />
        )}
      </WardrobePage>
    );
  return (
    <PreferencesContent
      key={session.generation}
      session={session}
      initial={preferences.data}
      options={options.data}
    />
  );
}
