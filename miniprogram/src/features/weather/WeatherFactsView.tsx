import { Text, View } from '@tarojs/components';
import { Notice } from '../../shared/ui';
import type { WeatherContext } from './api';
import { isWeatherDayCurrent, weatherTime } from './time';
import styles from './weather.module.scss';
const selectionLabels = {
  default: '默认城市',
  saved: '已保存城市',
  selected: '本次选择',
  location: '定位识别',
};
const missingLabels = {
  upstream_unavailable: '天气来源暂时不可用',
  invalid_source: '暂未取得可核验的天气',
  cache_busy: '天气读取繁忙，请稍后重试',
  lock_lost: '天气暂未准备好，请稍后重试',
  day_changed: '天气日期已变化，请重新读取',
};
export function WeatherFactsView({
  context,
  now = Date.now(),
}: {
  context: WeatherContext;
  now?: number;
}) {
  const current = isWeatherDayCurrent(context.weather_date, context.valid_until, now);
  const facts = current ? context.facts : null;
  return (
    <View className={styles.panel}>
      <Text className={styles.heading}>
        {context.region.display_name} · {selectionLabels[context.selection_source]}
      </Text>
      <Text className={styles.caption}>天气日期：{context.weather_date}（北京时间）</Text>
      {!current ? (
        <Notice>天气已过期，请重新读取；旧天气不会作为今日天气使用。</Notice>
      ) : !facts ? (
        <Notice>
          {context.missing_reason ? missingLabels[context.missing_reason] : '暂时没有可用天气'}
        </Notice>
      ) : (
        <>
          {facts.observation ? (
            <View className={styles.stack}>
              <Text className={styles.heading}>观测气温：{facts.observation.temperature_c}°C</Text>
              <Text className={styles.caption}>
                观测时间：{weatherTime(facts.observation.observed_at)}
              </Text>
            </View>
          ) : (
            <Text className={styles.caption}>暂无有时刻依据的观测气温</Text>
          )}
          {facts.forecast ? (
            <View className={styles.stack}>
              <Text className={styles.heading}>当日预报</Text>
              {facts.forecast.day_summary ? (
                <Text className={styles.caption}>白天：{facts.forecast.day_summary}</Text>
              ) : null}
              {facts.forecast.night_summary ? (
                <Text className={styles.caption}>夜间：{facts.forecast.night_summary}</Text>
              ) : null}
              {facts.forecast.high_c !== null ? (
                <Text className={styles.caption}>最高：{facts.forecast.high_c}°C</Text>
              ) : null}
              {facts.forecast.low_c !== null ? (
                <Text className={styles.caption}>最低：{facts.forecast.low_c}°C</Text>
              ) : null}
              <Text className={styles.caption}>
                预报发布时间：{weatherTime(facts.forecast.issued_at)}
              </Text>
            </View>
          ) : null}
          <Text className={styles.caption}>来源：中国天气网</Text>
          <Text className={styles.caption}>抓取时间：{weatherTime(facts.fetched_at)}</Text>
          <Text className={styles.caption}>有效至：{weatherTime(context.valid_until)}</Text>
        </>
      )}
    </View>
  );
}
