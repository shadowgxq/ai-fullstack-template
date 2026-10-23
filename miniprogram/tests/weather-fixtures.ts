import type { Region, WeatherContext } from '../src/features/weather/api';
import type { Profile } from '../src/shared/api/gateway';
export const region: Region = {
  city_id: 'cn-101210101',
  region_id: 'cn-101210101',
  weather_code: '101210101',
  province: '浙江',
  city: '杭州',
  district: '杭州',
  display_name: '浙江 / 杭州 / 杭州',
  mapping_version: 'test-catalog',
};
export const otherRegion: Region = {
  ...region,
  city_id: 'cn-101020100',
  region_id: 'cn-101020100',
  weather_code: '101020100',
  province: '上海',
  city: '上海',
  district: '上海',
  display_name: '上海 / 上海 / 上海',
};
export const profile: Profile = {
  user_id: 1,
  version: 3,
  nickname: '保留昵称',
  avatar_media_id: null,
  city_id: region.city_id,
};
export const context: WeatherContext = {
  context_id: '11111111-1111-4111-8111-111111111111',
  region,
  selection_source: 'saved',
  weather_date: '2026-10-22',
  valid_until: '2026-10-23T00:00:00+08:00',
  state: 'available',
  missing_reason: null,
  facts: {
    source: 'weather.com.cn',
    parser_version: 'weather1d.v1',
    fetched_at: '2026-10-22T10:00:00+08:00',
    valid_until: '2026-10-23T00:00:00+08:00',
    observation: null,
    forecast: {
      forecast_date: '2026-10-22',
      issued_at: '2026-10-22T08:00:00+08:00',
      day_summary: null,
      night_summary: '多云',
      high_c: null,
      low_c: 18,
    },
  },
};
export const now = Date.parse('2026-10-22T12:00:00+08:00');
