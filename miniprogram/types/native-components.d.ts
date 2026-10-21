import type { ReactNode } from 'react';
import type { BaseEventOrig } from '@tarojs/components';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'library-swipe-cell': {
        children?: ReactNode;
        'right-width': number;
        opened: boolean;
        onStart: () => void;
        onChange: (event: BaseEventOrig<{ opened: boolean }>) => void;
        onCellclick: (event: BaseEventOrig<{ wasOpen: boolean }>) => void;
      };
    }
  }
}
