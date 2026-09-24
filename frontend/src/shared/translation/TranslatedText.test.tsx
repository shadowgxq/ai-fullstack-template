import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PageTranslationController } from './translation.types';
import { TranslatedText } from './TranslatedText';

function createController(
  status: ReturnType<PageTranslationController['resolve']>['status'],
  text: string,
): PageTranslationController {
  return {
    sourceLanguage: 'en-US',
    targetLanguage: 'zh-CN',
    isTranslating: status === 'loading',
    resolve: () => ({ status, text }),
  };
}

describe('TranslatedText', () => {
  it('翻译中按字段显示可访问的 Skeleton', () => {
    render(
      <TranslatedText
        translations={createController('loading', 'Gold rose today.')}
        sourceText="Gold rose today."
        loadingLabel="正在翻译内容"
        skeletonLines={2}
      />,
    );

    const loading = screen.getByRole('status', { name: '正在翻译内容' });
    expect(loading).toHaveAttribute('data-translation-state', 'loading');
    expect(loading.children).toHaveLength(2);
    expect(screen.queryByText('Gold rose today.')).not.toBeInTheDocument();
  });

  it('翻译完成后显示中文并暴露 translated 状态', () => {
    render(
      <TranslatedText
        translations={createController('translated', '黄金今天上涨。')}
        sourceText="Gold rose today."
        loadingLabel="正在翻译内容"
      />,
    );

    expect(screen.getByText('黄金今天上涨。')).toHaveAttribute(
      'data-translation-state',
      'translated',
    );
  });
});
