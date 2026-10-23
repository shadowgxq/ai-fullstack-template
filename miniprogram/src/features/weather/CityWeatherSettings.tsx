import { useEffect, useRef, useState } from 'react';
import { Button as NativeButton, Text } from '@tarojs/components';
import { WardrobeIcon } from '../wardrobe/Icon';
import { getAuthSession, type AuthSession } from '../../shared/api/auth-token';
import type { Profile } from '../../shared/api/gateway';
import { queryClient } from '../../shared/query/client';
import { shanghaiToday } from '../wear-history/date';
import { CitySheet } from './CitySheet';
import { refreshCityFacts, weatherQueryOptions } from './queries';
import styles from './weather.module.scss';
export function CityWeatherSettings({
  session,
  profile,
}: {
  session: AuthSession;
  profile: Profile;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const context = queryClient.getQueryData(
    weatherQueryOptions(session, profile.city_id, shanghaiToday()).queryKey,
  );
  return (
    <>
      <NativeButton className={styles.settingsRow} onClick={() => setOpen(true)}>
        <WardrobeIcon name="map-pin" />
        <Text className={styles.settingsName}>城市与天气</Text>
        <Text className={styles.caption}>
          {context?.region.display_name ?? (profile.city_id ? '已保存城市' : '默认杭州')} ›
        </Text>
      </NativeButton>
      {open ? (
        <CitySheet
          session={session}
          initial={profile}
          currentLabel={
            context?.region.display_name ?? (profile.city_id ? '已保存城市' : '默认城市')
          }
          onClose={() => setOpen(false)}
          onSaved={async (saved) => {
            if (!mounted.current || getAuthSession() !== session) return;
            await refreshCityFacts(session, saved).catch(() => undefined);
            if (mounted.current && getAuthSession() === session) setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
