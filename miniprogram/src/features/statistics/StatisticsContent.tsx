import { Button as NativeButton, Text, View } from '@tarojs/components';
import { statusLabel, type Choice } from '../wardrobe/controls';
import { categoryWidths, segmentTrend } from './trend';
import type { GarmentWearCount, Statistics } from './api';
import styles from './statistics.module.scss';

export function StatisticsContent({
  value,
  categories,
}: {
  value: Statistics;
  categories: readonly Choice[];
}) {
  const categoryLabel = (category: string | null) =>
    category === null
      ? '未分类'
      : (categories.find((option) => option.id === category)?.label ?? category);
  const widths = categoryWidths(value.category_counts.map((item) => item.count));
  const segments = segmentTrend(value.trend.days.map((day) => [day.date, day.count] as const));
  const max = segments.reduce((largest, segment) => Math.max(largest, segment.count), 0);
  return (
    <>
      <View className={styles.metrics}>
        {[
          { label: '衣物总数', count: value.wardrobe_total },
          { label: '已归档', count: value.archived_count },
          { label: '穿搭次数', count: value.wear_record_count },
        ].map((metric) => (
          <View className={styles.metric} key={metric.label}>
            <Text className={styles.metricValue}>{metric.count}</Text>
            <Text className={styles.caption}>{metric.label}</Text>
          </View>
        ))}
      </View>
      <Text className={styles.caption}>
        总数含可穿与暂不可穿衣物，归档另列。穿搭次数为全部有效记录。
      </Text>
      <View className={styles.section}>
        <Text className={styles.heading}>类别分布</Text>
        {value.category_counts.length ? (
          value.category_counts.map((item, index) => (
            <View key={item.category ?? 'uncategorized'} className={styles.category}>
              <View className={styles.row}>
                <Text>{categoryLabel(item.category)}</Text>
                <Text className={styles.caption}>{item.count} 件</Text>
              </View>
              <View className={styles.categoryTrack}>
                <View className={styles.categoryBar} style={{ width: widths[index] + '%' }} />
              </View>
            </View>
          ))
        ) : (
          <Text className={styles.caption}>暂无未归档衣物</Text>
        )}
      </View>
      <View className={styles.section}>
        <Text className={styles.heading}>近 30 天的穿着趋势</Text>
        {value.wear_record_count === 0 ? (
          <Text className={styles.caption}>暂无已记录穿着</Text>
        ) : max === 0 ? (
          <Text className={styles.caption}>这个日期范围暂无已记录穿着</Text>
        ) : null}
        <View className={styles.trend}>
          {segments.map((segment) => (
            <View key={segment.startDate} className={styles.trendColumn}>
              <View className={styles.trendPlot}>
                <View
                  className={styles.trendBar}
                  style={{ height: (max ? (segment.count / max) * 100 : 0) + '%' }}
                >
                  <Text className={styles.trendCount}>{segment.count}</Text>
                </View>
              </View>
              <Text className={styles.rangeLabel}>
                {segment.startDate.slice(5).replace('-', '/')}
              </Text>
            </View>
          ))}
        </View>
        <Text className={styles.caption}>
          {value.trend.start_date} 至 {value.trend.end_date}，北京时间；按 7 日分段汇总，最后一段为
          2 天。
        </Text>
      </View>
    </>
  );
}
export function GarmentCountRows({
  items,
  onOpen,
}: {
  items: readonly GarmentWearCount[];
  onOpen: (id: string) => void;
}) {
  return (
    <View className={styles.section}>
      {items.map((item) => (
        <NativeButton
          key={item.garment_id}
          className={styles.garmentRow}
          onClick={() => onOpen(item.garment_id)}
        >
          <View className={styles.garmentLabel}>
            <Text>{item.name || '未命名衣物'}</Text>
            <Text className={styles.caption}>{statusLabel(item.status)}</Text>
          </View>
          <Text className={styles.caption}>{item.wear_count} 次 ›</Text>
        </NativeButton>
      ))}
    </View>
  );
}
