import type { ReactNode } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import wardrobeImage from '../../assets/wardrobe/empty-state/wardrobe.png';
import outfitImage from '../../assets/wardrobe/empty-state/outfit.png';
import recordsImage from '../../assets/wardrobe/empty-state/records.png';
import loginImage from '../../assets/wardrobe/empty-state/login.png';
import wechatIcon from '../../assets/wardrobe/empty-state/wechat.png';
import styles from './empty-state.module.scss';

const content = {
  wardrobe: {
    image: wardrobeImage,
    title: '从第一件衣物开始',
    detail: '拍照添加你的衣物\n让日常整理更轻松',
    action: '添加第一件衣物',
  },
  outfit: {
    image: outfitImage,
    title: '穿搭灵感，从衣柜开始',
    detail: '先添加几件常穿的衣物\n再来获取适合你的搭配建议',
    action: '去添加衣物',
  },
  records: {
    image: recordsImage,
    title: '记下你的第一套穿搭',
    detail: '记录穿过的搭配\n下次选衣，多一份灵感',
    action: '记录一次穿搭',
  },
  login: {
    image: loginImage,
    title: '开启你的专属衣柜',
    detail: '登录后管理衣物、获取搭配建议\n把喜欢的日常穿搭记录下来',
    action: '微信登录',
  },
};

/** 业务空态共用 SKORD 的结构；加载和请求失败由各页面单独表达。 */
export function WardrobeEmptyState({
  kind,
  presentation = 'page',
  title,
  detail,
  actionLabel,
  actionIcon,
  onAction,
  loading = false,
  disabled = false,
  feedback,
  note,
  secondaryAction,
}: {
  kind: keyof typeof content;
  presentation?: 'page' | 'inline' | 'profile';
  title?: string;
  detail?: string;
  actionLabel?: string;
  actionIcon?: 'plus' | 'wechat' | null;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
  feedback?: ReactNode;
  note?: string;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const value = content[kind];
  const icon =
    actionIcon === undefined
      ? kind === 'login'
        ? 'wechat'
        : kind === 'outfit'
          ? null
          : 'plus'
      : actionIcon;
  return (
    <View className={`${styles.frame} ${styles[presentation]}`}>
      <View className={styles.content}>
        <Image src={value.image} className={styles.illustration} mode="aspectFit" />
        <Text className={styles.title}>{title ?? value.title}</Text>
        <Text className={styles.description}>{detail ?? value.detail}</Text>
        {feedback}
        <Button
          className={styles.action}
          hoverClass={styles.pressed}
          disabled={disabled || loading}
          loading={loading}
          onClick={onAction}
        >
          {!loading && icon === 'wechat' ? (
            <Image src={wechatIcon} className={styles.wechat} mode="aspectFit" />
          ) : null}
          {!loading && icon === 'plus' ? <Text className={styles.plus}>＋</Text> : null}
          <Text>{actionLabel ?? value.action}</Text>
        </Button>
        {note ? <Text className={styles.note}>{note}</Text> : null}
        {secondaryAction ? (
          <Button className={styles.secondary} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
