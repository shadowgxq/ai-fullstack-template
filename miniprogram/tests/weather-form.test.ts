import { Children, isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@tarojs/components', () => ({ Text: 'text', View: 'view' }));
vi.mock('../src/shared/ui', () => ({ Button: 'button', Field: 'field', Notice: 'notice' }));
import { WeatherFactsView } from '../src/features/weather/WeatherFactsView';
import { context, now } from './weather-fixtures';
import { CitySearchForm } from '../src/features/weather/CitySearchForm';
type Props = { children?: ReactNode; [key: string]: unknown };
function nodes(tree: ReactNode, type: string): Props[] {
  return Children.toArray(tree).flatMap((node) =>
    !isValidElement<Props>(node)
      ? []
      : [...(node.type === type ? [node.props] : []), ...nodes(node.props.children, type)],
  );
}
function form(saving = false, locating = false) {
  const onLocate = vi.fn();
  const onQuery = vi.fn();
  const tree = CitySearchForm({
    query: '朝阳',
    currentLabel: '当前已保存城市',
    saving,
    locating,
    error: null,
    onLocate,
    onQuery,
  });
  return {
    onLocate,
    onQuery,
    button: nodes(tree, 'button')[0],
    field: nodes(tree, 'field')[0],
    labels: nodes(tree, 'text').map((node) => Children.toArray(node.children).join('')),
  };
}
describe('explicit city search form', () => {
  it('does not locate on render and keeps the current city visible while searching', () => {
    const view = form();
    expect(view.onLocate).not.toHaveBeenCalled();
    expect(view.field.value).toBe('朝阳');
    expect(view.labels).toContain('当前城市：当前已保存城市');
    (view.field.onValueChange as (query: string) => void)('上海');
    expect(view.onQuery).toHaveBeenCalledExactlyOnceWith('上海');
    (view.button.onClick as () => void)();
    expect(view.onLocate).toHaveBeenCalledOnce();
  });
  it('keeps manual search available while native location is pending and prevents repeat locating', () => {
    const view = form(false, true);
    expect(view.button.loading).toBe(true);
    (view.button.onClick as () => void)();
    expect(view.onLocate).not.toHaveBeenCalled();
    (view.field.onValueChange as (query: string) => void)('北京');
    expect(view.onQuery).toHaveBeenCalledWith('北京');
  });
  it('locks both inputs during profile saving, including stale native events', () => {
    const view = form(true);
    expect(view.field.disabled).toBe(true);
    expect(view.button.disabled).toBe(true);
    (view.button.onClick as () => void)();
    (view.field.onValueChange as (query: string) => void)('late');
    expect(view.onLocate).not.toHaveBeenCalled();
    expect(view.onQuery).not.toHaveBeenCalled();
  });
});

describe('weather facts presentation', () => {
  const visible = (tree: ReactNode) =>
    nodes(tree, 'text')
      .map((node) => Children.toArray(node.children).join(''))
      .join('\n');
  it('shows partial forecast and distinct source times without inventing observation, bounds or advice', () => {
    const labels = visible(WeatherFactsView({ context, now }));
    expect(labels).toContain('夜间：多云');
    expect(labels).toContain('暂无有时刻依据的观测气温');
    expect(labels).toContain('最低：18°C');
    expect(labels).not.toContain('最高：');
    expect(labels).toContain('预报发布时间：2026-10-22 08:00');
    expect(labels).toContain('抓取时间：2026-10-22 10:00');
    expect(labels).toContain('来源：中国天气网');
    expect(labels).not.toContain('weather1d.v1');
    expect(labels).not.toContain('外搭');
    expect(labels).not.toContain('实时');
  });
  it('hides expired facts at midnight and keeps a missing context bound to its actual city', () => {
    const expired = WeatherFactsView({ context, now: Date.parse(context.valid_until) });
    expect(visible(expired)).not.toContain('夜间：多云');
    expect(nodes(expired, 'notice')).toHaveLength(1);
    const missing = WeatherFactsView({
      context: {
        ...context,
        selection_source: 'default',
        facts: null,
        state: 'missing',
        missing_reason: 'upstream_unavailable',
      },
      now,
    });
    expect(visible(missing)).toContain(context.region.display_name + ' · 默认城市');
    expect(visible(missing)).not.toContain('最低：');
  });
});
