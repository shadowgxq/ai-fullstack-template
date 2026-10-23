import { useEffect, useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuthSession } from '../../shared/api/auth-token';
import { shanghaiToday } from '../wear-history/date';
import { nextShanghaiMidnight } from '../weather/time';
import { statisticsQueryOptions } from './queries';

/** 概览复用统计事实，分页已加载数量不能冒充库存或记录总数。 */
export function useStatisticsSummary(session: AuthSession | null) {
  const [day, setDay] = useState(shanghaiToday);
  const query = useInfiniteQuery(statisticsQueryOptions(session, day));
  useEffect(() => {
    const timer = setTimeout(
      () => setDay(shanghaiToday()),
      Math.max(1, nextShanghaiMidnight(day) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [day]);
  useDidShow(() => {
    const today = shanghaiToday();
    setDay(today);
    if (session && today === day) void query.refetch();
  });
  return query.data?.pages[0];
}
