import { describe, expect, it } from 'vitest';

import { extractSharePosterEditorialContent } from './share-poster-content';

describe('share poster editorial content', () => {
  it('extracts a headline, summary and three highlights from Markdown headings', () => {
    const content = extractSharePosterEditorialContent(
      '英伟达',
      `# 算力霸权，但估值已到警戒区

增长逻辑仍在兑现，风险已经进入定价核心。

## 技术垄断
GPU 性能持续领先。产品迭代维持定价权。

## 生态壁垒
CUDA 构成迁移成本。开发者与客户深度绑定。

## 需求爆发
AI 基建采购加速。增长已获财报与订单验证。`,
      [],
    );

    expect(content).toEqual({
      headline: '英伟达：算力霸权，但估值已到警戒区',
      summary: '增长逻辑仍在兑现，风险已经进入定价核心。',
      highlights: [
        { label: '技术垄断', title: 'GPU 性能持续领先', description: '产品迭代维持定价权。' },
        { label: '生态壁垒', title: 'CUDA 构成迁移成本', description: '开发者与客户深度绑定。' },
        { label: '需求爆发', title: 'AI 基建采购加速', description: '增长已获财报与订单验证。' },
      ],
    });
  });

  it('uses structured fallback sources when the conclusion is a plain paragraph', () => {
    const content = extractSharePosterEditorialContent(
      'NVIDIA',
      '增长逻辑仍在兑现。估值风险已经进入定价核心。',
      [
        { label: '行业研究', markdown: '**技术领先**：GPU 产品力保持优势。' },
        { label: '质量筛选', markdown: '- CUDA 生态提高迁移成本' },
      ],
    );

    expect(content.headline).toBe('NVIDIA：增长逻辑仍在兑现。');
    expect(content.summary).toBe('估值风险已经进入定价核心。');
    expect(content.highlights).toEqual([
      { label: '技术领先', title: 'GPU 产品力保持优势' },
      { label: '质量筛选', title: 'CUDA 生态提高迁移成本' },
    ]);
  });

  it('ignores Markdown tables and splits a long clause into title and description', () => {
    const content = extractSharePosterEditorialContent('英伟达', '结论保持不变。', [
      {
        label: '关键机会',
        markdown: `| 机会 | 判断 | 来源 |
| --- | --- | --- |

生态壁垒，CUDA 与开发者工具链共同提高客户迁移成本。`,
      },
    ]);

    expect(content.highlights).toEqual([
      {
        label: '关键机会',
        title: '生态壁垒',
        description: 'CUDA 与开发者工具链共同提高客户迁移成本。',
      },
    ]);
  });

  it('promotes labeled company conclusion bullets and fills each highlight from its value', () => {
    const content = extractSharePosterEditorialContent('英伟达', '行业结论保持不变。', [
      {
        label: '最终公司',
        markdown: `## 英伟达（NVIDIA Corporation）

- **为什么入选：** 作为全球唯一能提供完整软硬一体解决方案的厂商，其在数据中心业务中占比已达 89%，收入增速持续高于行业平均水平。
- **核心优势：** 拥有技术壁垒、品牌定价权、生态网络效应和规模效应，其 CUDA 生态形成正反馈循环，难以复制。
- **最大风险：** 估值泡沫破裂（当前市盈率约 80 倍），地缘政治限制海外销售，以及潜在的技术替代风险。
- **是否值得深研：** 是。尽管估值偏高，但其商业模式清晰。`,
      },
    ]);

    expect(content.highlights).toEqual([
      {
        label: '为什么入选',
        title: '作为全球唯一能提供完整软硬一体解决方案的厂商',
        description: '其在数据中心业务中占比已达 89%，收入增速持续高于行业平均水平。',
      },
      {
        label: '核心优势',
        title: '拥有技术壁垒、品牌定价权、生态网络效应和规模效应',
        description: '其 CUDA 生态形成正反馈循环，难以复制。',
      },
      {
        label: '最大风险',
        title: '估值泡沫破裂（当前市盈率约 80 倍）',
        description: '地缘政治限制海外销售，以及潜在的技术替代风险。',
      },
    ]);
  });
});
