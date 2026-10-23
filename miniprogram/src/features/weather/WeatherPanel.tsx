import { useEffect, useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { Button as NativeButton, Text, View } from '@tarojs/components';
import { useQuery } from '@tanstack/react-query';
import { Button, Notice } from '../../shared/ui';
import type { AuthSession } from '../../shared/api/auth-token';
import { errorMessage } from '../../shared/api/errors';
import { shanghaiToday } from '../wear-history/date';
import { isWeatherDayCurrent, nextShanghaiMidnight } from './time';
import { weatherQueryOptions } from './queries';
import { WeatherFactsView } from './WeatherFactsView';
import styles from './weather.module.scss';
export function WeatherPanel({
  session,
  cityId,
  compact = false,
  onOpen,
}: {
  session: AuthSession;
  cityId: string | null;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [clock, setClock] = useState(Date.now);
  const day = shanghaiToday(clock);
  useEffect(() => {
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(1, nextShanghaiMidnight(day) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [day]);
  useDidShow(() => setClock(Date.now()));
  const weather = useQuery(weatherQueryOptions(session, cityId, day));
  if (compact) {
    const context = weather.data;
    const current = context && isWeatherDayCurrent(context.weather_date, context.valid_until);
    const facts = current ? context.facts : null;
    const forecast = facts?.forecast;
    const range =
      forecast?.low_c != null && forecast.high_c != null
        ? `${forecast.low_c}–${forecast.high_c}°C`
        : null;
    const summary =
      range || (facts?.observation ? `${facts.observation.temperature_c}°C` : '暂无可用天气');
    return (
      <NativeButton className={styles.summary} onClick={onOpen} ariaLabel="城市与天气">
        <Text className={styles.summaryTitle}>
          {context?.region.display_name ?? '城市与天气'} · {weather.isPending ? '读取中' : summary}
        </Text>
        <Text className={styles.summaryCaption}>
          {weather.isError
            ? '天气读取失败，点击重试'
            : context && !current
              ? '天气已过期，点击重新读取'
              : (forecast?.day_summary ?? '查看天气与切换城市')}{' '}
          ›
        </Text>
      </NativeButton>
    );
  }
  return (
    <View className={styles.stack}>
      {weather.data ? (
        <WeatherFactsView context={weather.data} />
      ) : weather.isPending ? (
        <Notice>正在读取当前城市天气</Notice>
      ) : null}
      {weather.isError ? (
        <Notice tone="error">天气读取失败：{errorMessage(weather.error)}</Notice>
      ) : null}
      <Button
        variant="secondary"
        loading={weather.isFetching}
        onClick={() => {
          setClock(Date.now());
          void weather.refetch();
        }}
      >
        重新读取天气
      </Button>
    </View>
  );
}
