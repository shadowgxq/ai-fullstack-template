import { useEffect, useRef, useState } from 'react';
import { Button as NativeButton } from '@tarojs/components';
import { Button, Notice } from '../../shared/ui';
import { ApiError } from '../../shared/api/errors';
import type { AuthSession } from '../../shared/api/auth-token';
import type { Profile } from '../../shared/api/gateway';
import { Sheet } from '../wardrobe/controls';
import { CitySearchForm } from './CitySearchForm';
import { WeatherPanel } from './WeatherPanel';
import { weatherApi, type Region, type CityList } from './api';
import { CityEditor } from './city-editor';
import { CityOperations } from './operations';
import { resolveCurrentCity } from './location';
import { weatherError } from './errors';
import styles from './weather.module.scss';

export function CitySheet({
  session,
  initial,
  currentLabel,
  onSaved,
  onClose,
}: {
  session: AuthSession;
  initial: Profile;
  currentLabel: string;
  onSaved: (profile: Profile) => Promise<void>;
  onClose: () => void;
}) {
  const [operations] = useState(() => new CityOperations(session));
  const [editor] = useState(() => new CityEditor(session, initial));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityList | null>(null);
  const [selected, setSelected] = useState<Region | null | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<{
    profile: Profile;
    region: Region | null;
    unverified: boolean;
  } | null>(null);
  const [reading, setReading] = useState(false);
  const lock = useRef(false);
  const locatingLock = useRef(false);
  const selectedId = selected === undefined ? initial.city_id : (selected?.city_id ?? null);
  const close = () => {
    operations.close();
    editor.close();
    onClose();
  };
  useEffect(
    () => () => {
      operations.close();
      editor.close();
    },
    [operations, editor],
  );
  const check = (operation: ReturnType<CityOperations['begin']>): boolean => {
    try {
      operation.check();
      return true;
    } catch {
      return false;
    }
  };
  const search = async (
    value: string,
    cursor: string | null = null,
    previous: CityList | null = null,
  ) => {
    if (!operations.active() || lock.current || uncertain || saved) return;
    const operation = operations.begin('search');
    setSearching(true);
    setError(null);
    if (!value.trim() || [...value].length > 80) {
      setSearching(false);
      setResults(null);
      if (value.trim()) setError('城市名称最多填写80个字符');
      return;
    }
    try {
      const page = await weatherApi.cities(value, cursor, operation.signal);
      operation.check();
      if (cursor && previous) {
        if (
          previous.mapping_version !== page.mapping_version ||
          page.items.some((item) =>
            previous.items.some((before) => before.city_id === item.city_id),
          ) ||
          page.next_cursor === cursor
        )
          throw new ApiError('城市目录已更新，请重新搜索', 'http', 409, 40970);
        setResults({ ...page, items: [...previous.items, ...page.items] });
      } else setResults(page);
    } catch (error) {
      if (check(operation)) {
        if (cursor) setResults(null);
        setError(weatherError(error));
      }
    } finally {
      if (check(operation)) setSearching(false);
    }
  };
  const persist = async (region: Region | null, operation: ReturnType<CityOperations['begin']>) => {
    operation.check();
    lock.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    setLatest(null);
    try {
      const profile = await editor.save(region?.city_id ?? null, operation.signal);
      operation.check();
      setSaved(true);
      setUncertain(false);
      await onSaved(profile);
      operation.check();
    } catch (error) {
      if (check(operation)) {
        setUncertain(editor.uncertain);
        setConflict(error instanceof ApiError && error.status === 409);
        setError(
          editor.saved
            ? '城市已保存，请重试完成'
            : error instanceof ApiError && error.status === 409
              ? '资料已更新；城市选择已保留，请读取最新资料后确认重试'
              : weatherError(error),
        );
      }
    } finally {
      lock.current = false;
      if (check(operation)) setSaving(false);
    }
  };
  const choose = (region: Region | null) => {
    if (!operations.active() || lock.current || uncertain || saved || reading) return;
    setSelected(region);
    setSearching(false);
    locatingLock.current = false;
    setLocating(false);
    void persist(region, operations.begin('selection'));
  };
  const locate = async () => {
    if (
      !operations.active() ||
      lock.current ||
      uncertain ||
      saved ||
      reading ||
      locatingLock.current
    )
      return;
    const operation = operations.begin('selection');
    locatingLock.current = true;
    setSearching(false);
    setLocating(true);
    setError(null);
    try {
      const context = await resolveCurrentCity(operation);
      operation.check();
      if (context) {
        setSelected(context.region);
        await persist(context.region, operation);
        operation.check();
      }
    } catch (error) {
      if (check(operation)) setError(weatherError(error));
    } finally {
      if (check(operation)) {
        locatingLock.current = false;
        setLocating(false);
      }
    }
  };
  const readLatest = async () => {
    if (!operations.active() || lock.current || reading) return;
    const operation = operations.begin('selection');
    setSearching(false);
    setReading(true);
    setLatest(null);
    try {
      const value = await editor.readLatestSelection(operation.signal);
      operation.check();
      setLatest(value);
    } catch (error) {
      if (check(operation)) setError(weatherError(error));
    } finally {
      if (check(operation)) setReading(false);
    }
  };
  return (
    <Sheet title="城市与天气" onClose={close} busy={saving}>
      <CitySearchForm
        query={query}
        currentLabel={currentLabel}
        locating={locating}
        saving={saving || uncertain || saved || reading}
        error={error}
        onLocate={() => {
          void locate();
        }}
        onQuery={(value) => {
          if (!operations.active() || lock.current || uncertain || saved || reading) return;
          operations.cancelSelection();
          locatingLock.current = false;
          setLocating(false);
          setQuery(value);
          setResults(null);
          setLatest(null);
          setConflict(false);
          void search(value);
        }}
      >
        {selected !== undefined ? (
          <Notice>
            当前选择：{selected ? selected.display_name : '清除保存城市，恢复默认规则'}
          </Notice>
        ) : null}
        {uncertain ? <Notice>上次保存结果尚未确认，请先重试原城市；选择已保留。</Notice> : null}
        {searching ? <Notice>正在搜索可信城市目录</Notice> : null}
        {results && !results.items.length ? <Notice>没有找到匹配地区，请调整关键词</Notice> : null}
        {!query.trim() ? (
          <Notice>输入城市名称后选择完整省市区县；不会自动采用第一条结果。</Notice>
        ) : null}
        {results?.items.map((region) => (
          <NativeButton
            key={region.city_id}
            className={`${styles.choice} ${selectedId === region.city_id ? styles.selected : ''}`}
            disabled={saving || uncertain || saved || reading}
            onClick={() => choose(region)}
          >
            {selectedId === region.city_id ? '✓ ' : ''}
            {region.display_name}
          </NativeButton>
        ))}
        {results?.next_cursor ? (
          <Button
            variant="secondary"
            loading={searching}
            disabled={saving || uncertain || saved || reading}
            onClick={() => {
              void search(query, results.next_cursor, results);
            }}
          >
            加载更多城市
          </Button>
        ) : null}
        {query.trim() && !searching ? (
          <Button
            variant="secondary"
            disabled={saving || uncertain || saved || reading}
            onClick={() => {
              void search(query);
            }}
          >
            重新搜索
          </Button>
        ) : null}
        {conflict ? (
          <>
            <Button
              variant="secondary"
              loading={reading}
              onClick={() => {
                void readLatest();
              }}
            >
              读取最新资料
            </Button>
            {latest ? (
              <>
                <Notice>
                  最新城市：
                  {latest.unverified
                    ? '旧城市无法核验，天气使用默认规则'
                    : (latest.region?.display_name ?? '未保存城市，使用默认规则')}
                  。昵称与头像仍使用最新资料。
                </Notice>
                <Button
                  variant="secondary"
                  disabled={saving || selected === undefined}
                  onClick={() => {
                    if (!operations.active() || lock.current || selected === undefined) return;
                    editor.acceptLatest(latest.profile);
                    setLatest(null);
                    void persist(selected, operations.begin('selection'));
                  }}
                >
                  按最新版本重试当前选择
                </Button>
              </>
            ) : null}
          </>
        ) : null}
        {uncertain || saved || (selected !== undefined && !conflict) ? (
          <Button
            loading={saving}
            onClick={() => {
              if (!operations.active() || lock.current || selected === undefined) return;
              void persist(selected, operations.begin('selection'));
            }}
          >
            {saved ? '重试完成' : '重试保存当前选择'}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          disabled={saving || uncertain || saved || reading}
          onClick={() => choose(null)}
        >
          清除保存城市
        </Button>
      </CitySearchForm>
      <WeatherPanel session={session} cityId={initial.city_id} />
    </Sheet>
  );
}
