import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { Button, Notice, StatePanel } from '../../shared/ui';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { sessionQueryKey } from '../../shared/query/client';
import { WardrobePage } from '../../features/wardrobe/Page';
import { WardrobeEmptyState } from '../../features/wardrobe/EmptyState';
import { garmentListQueryOptions } from '../../features/wardrobe/queries';
import { useWardrobeSession } from '../../features/wardrobe/session';
import { Sheet } from '../../features/wardrobe/controls';
import { WardrobeNavigation } from '../../features/wear-history/Navigation';
import { wearApi } from '../../features/wear-history/api';
import { shanghaiToday } from '../../features/wear-history/date';
import { RecordCard } from '../../features/wear-history/RecordCard';
import { profileQueryOptions } from '../../features/profile/queries';
import { WeatherPanel } from '../../features/weather/WeatherPanel';
import { CitySheet } from '../../features/weather/CitySheet';
import { refreshCityFacts, weatherQueryOptions } from '../../features/weather/queries';
import { nextShanghaiMidnight } from '../../features/weather/time';
import { isWeatherDayCurrent } from '../../features/weather/time';
import { scenes, type Scene } from '../../features/outfits/api';
import { outfitSession } from '../../features/outfits/session';
import { OutfitActions, OutfitResult } from '../../features/outfits/OutfitView';
import { ReplacementSheet } from '../../features/outfits/ReplacementSheet';
import { openRecommendedWear } from '../../features/outfits/wear-prefill';
import { wardrobeApi } from '../../features/wardrobe/api';
import { WardrobeIcon } from '../../features/wardrobe/Icon';
import styles from '../../features/outfits/outfits.module.scss';

export default function OutfitsPage() {
  const session = useWardrobeSession();
  if (!session)
    return (
      <WardrobePage
        title="今日穿搭"
        account
        bottomNavigation={<WardrobeNavigation active="outfits" />}
      >
        <View className={styles.content}>
          <StatePanel state="empty" title="请先微信登录" detail="使用自己的衣柜生成穿搭建议。" />
          <Button
            onClick={() => {
              void Taro.navigateTo({ url: '/pages/login/index' });
            }}
          >
            微信登录
          </Button>
        </View>
      </WardrobePage>
    );
  return <OutfitsContent key={session.generation} session={session} />;
}
function OutfitsContent({ session }: { session: AuthSession }) {
  const controller = outfitSession(session);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const inventory = useInfiniteQuery({
    ...garmentListQueryOptions(session, {}),
    enabled: !state.view || state.view.outcome === 'no_inventory',
  });
  const awaitingInventory = !state.view && !state.creating && !state.uncertain && !state.error;
  const emptyInventory =
    (awaitingInventory ||
      (state.view?.status === 'ready' && state.view.outcome === 'no_inventory')) &&
    !state.creating &&
    !state.uncertain &&
    !state.error &&
    inventory.isSuccess &&
    !inventory.data.pages[0].items.length;
  const [scene, setScene] = useState<Scene>(() => controller.snapshot().submitted?.scene ?? 'any');
  const [sceneOpen, setSceneOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const confirmLock = useRef(false);
  const pageActive = useRef(true);
  const [clock, setClock] = useState(Date.now);
  const day = shanghaiToday(clock);
  useEffect(() => {
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(1, nextShanghaiMidnight(day) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [day]);
  useEffect(() => {
    pageActive.current = true;
    controller.setVisible(true);
    return () => {
      pageActive.current = false;
      controller.setVisible(false);
    };
  }, [controller]);
  useDidShow(() => {
    pageActive.current = true;
    setClock(Date.now());
    controller.setVisible(true);
    if (!state.view || state.view.outcome === 'no_inventory') void inventory.refetch();
  });
  useDidHide(() => {
    pageActive.current = false;
    controller.setVisible(false);
  });
  useEffect(() => {
    controller.refreshIfVisible();
  }, [controller, day]);
  const profile = useQuery(profileQueryOptions(session));
  const options = useQuery({
    queryKey: sessionQueryKey(session, 'wardrobe-options'),
    queryFn: ({ signal }) => wardrobeApi.options(signal),
  });
  const weather = useQuery({
    ...weatherQueryOptions(session, profile.data?.city_id ?? null, day),
    enabled: Boolean(profile.data),
  });
  const history = useQuery({
    queryKey: sessionQueryKey(session, 'wear-records', 'outfit-latest'),
    queryFn: ({ signal }) => wearApi.list({}, null, signal),
  });
  const context =
    weather.data && isWeatherDayCurrent(weather.data.weather_date, weather.data.valid_until)
      ? weather.data
      : null;
  const generate = () => {
    setReplacement(null);
    void controller.generate({ scene, weather_context_id: context?.context_id ?? null });
  };
  const confirm = async () => {
    if (confirmLock.current) return;
    confirmLock.current = true;
    setNavigationError(null);
    try {
      await openRecommendedWear(
        controller,
        () => pageActive.current && getAuthSession() === session,
      );
    } catch (error) {
      if (pageActive.current && getAuthSession() === session)
        setNavigationError(errorMessage(error));
    } finally {
      confirmLock.current = false;
    }
  };
  const go = (url: string) => {
    void Taro.navigateTo({ url }).catch((error: unknown) => {
      if (pageActive.current && getAuthSession() === session)
        setNavigationError(errorMessage(error));
    });
  };
  if (emptyInventory || (awaitingInventory && inventory.isPending))
    return (
      <WardrobePage title="穿搭" account bottomNavigation={<WardrobeNavigation active="outfits" />}>
        {emptyInventory ? (
          <WardrobeEmptyState
            kind="outfit"
            onAction={() => go('/pages/garment-form/index')}
            feedback={navigationError ? <Notice tone="error">{navigationError}</Notice> : undefined}
          />
        ) : (
          <View className={styles.content}>
            <StatePanel state="loading" title="正在读取衣柜" />
          </View>
        )}
      </WardrobePage>
    );
  return (
    <WardrobePage
      title="今日穿搭"
      account
      bottomNavigation={<WardrobeNavigation active="outfits" />}
      footer={
        <OutfitActions
          state={state}
          onGenerate={generate}
          onCancel={() => {
            void controller.cancel();
          }}
          onConfirm={() => {
            void confirm();
          }}
        />
      }
    >
      <View className={styles.content}>
        <View className={styles.weather}>
          <View className={styles.weatherIcon}>
            <WardrobeIcon name="cloud-sun" tone="primary" />
          </View>
          {profile.data ? (
            <WeatherPanel
              session={session}
              cityId={profile.data.city_id}
              compact
              onOpen={() => setCityOpen(true)}
            />
          ) : (
            <Text className={styles.weatherStatus}>
              {profile.isError ? '城市资料暂时不可用，可继续生成建议' : '正在读取城市与天气'}
            </Text>
          )}
          <NativeButton
            className={styles.scene}
            ariaLabel="选择下次生成场景"
            onClick={() => {
              setSceneOpen(true);
            }}
          >
            <View className={styles.sceneFace}>
              <Text>{scenes.find((item) => item.id === scene)?.label}</Text>
              <WardrobeIcon name="chevron-down" />
            </View>
          </NativeButton>
        </View>
        {state.view ? (
          <Text className={styles.caption}>
            当前建议采用生成时的场景与天气依据。重新选择场景或城市后，请生成新建议。
          </Text>
        ) : null}
        {navigationError ? <Notice tone="error">{navigationError}</Notice> : null}
        {!state.view && inventory.isError ? (
          <Notice tone="error">
            衣柜暂时无法读取。
            <Button
              variant="secondary"
              onClick={() => {
                void inventory.refetch();
              }}
            >
              重试读取衣柜
            </Button>
          </Notice>
        ) : null}
        <OutfitResult
          state={state}
          categories={options.data?.categories ?? []}
          onReplace={setReplacement}
          onRetry={() => {
            void controller.refresh();
          }}
          onRetrySelection={() => {
            void controller.validate();
          }}
          onAdd={() =>
            go(
              state.view?.outcome === 'no_inventory'
                ? '/pages/garment-form/index'
                : '/pages/wardrobe/index',
            )
          }
          onPreferences={() => go('/pages/wardrobe-preferences/index')}
        />
        {history.data?.items[0] ? (
          <RecordCard
            compact
            record={history.data.items[0]}
            onOpen={() => go('/pages/wear-detail/index?id=' + history.data!.items[0].id)}
          />
        ) : history.isError ? (
          <Notice>最近穿着暂时无法读取，不影响继续生成建议。</Notice>
        ) : null}
      </View>
      {sceneOpen ? (
        <Sheet title="选择穿搭场景" onClose={() => setSceneOpen(false)}>
          <View className={styles.sceneChoices}>
            <Text className={styles.sceneDescription}>仅用于本次推荐，不会修改长期偏好。</Text>
            {scenes.map((item) => (
              <NativeButton
                key={item.id}
                className={`${styles.sceneChoice} ${scene === item.id ? styles.sceneSelected : ''}`}
                onClick={() => {
                  setScene(item.id);
                  setSceneOpen(false);
                }}
              >
                <View className={styles.sceneIcon}>
                  <WardrobeIcon
                    name={
                      item.id === 'work'
                        ? 'briefcase-business'
                        : item.id === 'daily'
                          ? 'footprints'
                          : item.id === 'date'
                            ? 'heart'
                            : 'sparkles'
                    }
                    tone={scene === item.id ? 'primary' : 'text'}
                  />
                </View>
                <View className={styles.sceneCopy}>
                  <Text>{item.label}</Text>
                  <Text className={styles.caption}>
                    {item.id === 'work'
                      ? '舒适得体，适合日常上班'
                      : item.id === 'daily'
                        ? '轻松自在，适合日常出行'
                        : item.id === 'date'
                          ? '精致自然，留一点仪式感'
                          : '不限定场合，按天气与偏好推荐'}
                  </Text>
                </View>
                {scene === item.id ? <Text className={styles.sceneCheck}>✓</Text> : null}
              </NativeButton>
            ))}
          </View>
        </Sheet>
      ) : null}
      {cityOpen && profile.data ? (
        <CitySheet
          session={session}
          initial={profile.data}
          currentLabel={context?.region.display_name ?? '当前城市'}
          onClose={() => setCityOpen(false)}
          onSaved={async (saved) => {
            if (getAuthSession() !== session) return;
            await refreshCityFacts(session, saved);
            if (getAuthSession() === session) setCityOpen(false);
          }}
        />
      ) : null}
      {replacement && state.view?.status === 'ready' ? (
        <ReplacementSheet
          key={state.view.request_id + ':' + replacement}
          session={session}
          requestId={state.view.request_id}
          selectedIds={state.selectedIds}
          targetId={replacement}
          onClose={() => setReplacement(null)}
          onChoose={(item) => {
            setReplacement(null);
            void controller.replace(replacement, item);
          }}
        />
      ) : null}
    </WardrobePage>
  );
}
