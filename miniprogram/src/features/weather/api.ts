import type { components } from '../../shared/api/schema.generated';
import { ApiError, isRecord } from '../../shared/api/errors';
import { parseEnvelope, requestJson } from '../../shared/api/request';
import { validUuid } from '../wardrobe/api';
import { isCalendarDate, shanghaiToday } from '../wear-history/date';
import { nextShanghaiMidnight, weatherTimestamp } from './time';

export type Region = components['schemas']['RegionView'];
export type CityList = components['schemas']['CityList'];
export type WeatherContext = components['schemas']['WeatherContextView'];
export type WeatherRequest = components['schemas']['WeatherContextRequest'];
type Facts = components['schemas']['WeatherFacts'];
type Forecast = components['schemas']['WeatherForecast'];
type Observation = components['schemas']['WeatherObservation'];
function malformed(): never {
  throw new ApiError('城市或天气数据格式不正确，请重试', 'invalid-response');
}
function text(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}
function temperature(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -100 && value <= 80;
}
export function parseRegion(value: unknown): Region {
  if (
    !isRecord(value) ||
    !text(value.city_id) ||
    !/^cn-101[0-9]{6}$/.test(value.city_id) ||
    value.region_id !== value.city_id ||
    value.weather_code !== value.city_id.slice(3) ||
    !text(value.province) ||
    !text(value.city) ||
    !text(value.district) ||
    !text(value.display_name) ||
    !text(value.mapping_version)
  )
    return malformed();
  return {
    city_id: value.city_id,
    region_id: value.city_id,
    weather_code: value.weather_code,
    province: value.province,
    city: value.city,
    district: value.district,
    display_name: value.display_name,
    mapping_version: value.mapping_version,
  };
}
export function parseCities(value: unknown): CityList {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    !text(value.mapping_version) ||
    !(value.next_cursor === null || (text(value.next_cursor) && value.next_cursor.length <= 2048))
  )
    return malformed();
  const items = value.items.map(parseRegion);
  if (
    new Set(items.map((item) => item.city_id)).size !== items.length ||
    items.some((item) => item.mapping_version !== value.mapping_version) ||
    (!items.length && value.next_cursor !== null)
  )
    return malformed();
  return { items, mapping_version: value.mapping_version, next_cursor: value.next_cursor };
}
function observation(value: unknown, day: string): Observation | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !weatherTimestamp(value.observed_at) ||
    shanghaiToday(Date.parse(value.observed_at)) !== day ||
    !temperature(value.temperature_c)
  )
    return malformed();
  return { observed_at: value.observed_at, temperature_c: value.temperature_c };
}
function forecast(value: unknown, day: string): Forecast | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.forecast_date !== day ||
    !weatherTimestamp(value.issued_at) ||
    shanghaiToday(Date.parse(value.issued_at)) !== day ||
    !(value.day_summary === null || text(value.day_summary)) ||
    !(value.night_summary === null || text(value.night_summary)) ||
    !(value.high_c === null || temperature(value.high_c)) ||
    !(value.low_c === null || temperature(value.low_c)) ||
    (typeof value.high_c === 'number' &&
      typeof value.low_c === 'number' &&
      value.high_c < value.low_c) ||
    (value.day_summary === null &&
      value.night_summary === null &&
      value.high_c === null &&
      value.low_c === null)
  )
    return malformed();
  return {
    forecast_date: day,
    issued_at: value.issued_at,
    day_summary: value.day_summary,
    night_summary: value.night_summary,
    high_c: value.high_c,
    low_c: value.low_c,
  };
}
function facts(value: unknown, day: string, validUntil: string): Facts | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.source !== 'weather.com.cn' ||
    value.parser_version !== 'weather1d.v1' ||
    !weatherTimestamp(value.fetched_at) ||
    shanghaiToday(Date.parse(value.fetched_at)) !== day ||
    !weatherTimestamp(value.valid_until) ||
    Date.parse(value.valid_until) !== Date.parse(validUntil)
  )
    return malformed();
  const result: Facts = {
    source: value.source,
    parser_version: value.parser_version,
    fetched_at: value.fetched_at,
    valid_until: value.valid_until,
    observation: observation(value.observation, day),
    forecast: forecast(value.forecast, day),
  };
  if (
    (!result.observation && !result.forecast) ||
    (result.observation &&
      Date.parse(result.observation.observed_at) > Date.parse(result.fetched_at)) ||
    (result.forecast && Date.parse(result.forecast.issued_at) > Date.parse(result.fetched_at))
  )
    return malformed();
  return result;
}
export function parseWeatherContext(value: unknown): WeatherContext {
  if (
    !isRecord(value) ||
    !validUuid(value.context_id) ||
    !isCalendarDate(value.weather_date) ||
    !weatherTimestamp(value.valid_until) ||
    Date.parse(value.valid_until) !== nextShanghaiMidnight(value.weather_date) ||
    !(
      value.selection_source === 'selected' ||
      value.selection_source === 'saved' ||
      value.selection_source === 'default' ||
      value.selection_source === 'location'
    ) ||
    !(value.state === 'available' || value.state === 'missing')
  )
    return malformed();
  const result = facts(value.facts, value.weather_date, value.valid_until);
  const reasons = [
    'upstream_unavailable',
    'invalid_source',
    'cache_busy',
    'lock_lost',
    'day_changed',
  ] as const;
  const reason = reasons.find((item) => item === value.missing_reason) ?? null;
  if (
    value.state === 'available'
      ? !result || value.missing_reason !== null
      : result !== null || reason === null
  )
    return malformed();
  return {
    context_id: value.context_id,
    region: parseRegion(value.region),
    selection_source: value.selection_source,
    weather_date: value.weather_date,
    valid_until: value.valid_until,
    state: value.state,
    facts: result,
    missing_reason: reason,
  };
}
export const weatherApi = {
  cities: (query: string, cursor: string | null = null, signal?: AbortSignal) =>
    requestJson(
      '/api/v1/cities?q=' +
        encodeURIComponent(query) +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      (value) => parseEnvelope(value, parseCities),
      { signal },
    ),
  context: (data: WeatherRequest = {}, signal?: AbortSignal) =>
    requestJson('/api/v1/weather/context', (value) => parseEnvelope(value, parseWeatherContext), {
      method: 'POST',
      data,
      signal,
    }),
};
