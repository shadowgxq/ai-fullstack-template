import { useEffect, useState, type PropsWithChildren } from 'react';
import { Button as NativeButton, Input, Label, Text, View } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { useTheme } from '../theme/preferences';
import { syncNativeTheme } from '../theme/native';
import styles from './ui.module.scss';

export function PageShell({
  children,
  withTabBar = false,
}: PropsWithChildren<{ withTabBar?: boolean }>) {
  const theme = useTheme();
  const applyTheme = () => {
    void syncNativeTheme(theme, withTabBar);
  };
  useEffect(() => {
    void syncNativeTheme(theme, withTabBar);
  }, [theme, withTabBar]);
  useDidShow(applyTheme);
  return (
    <View
      className={`mp-theme-root theme-${theme} ${styles.page} ${withTabBar ? styles.withTabBar : ''}`}
    >
      <View className={styles.content}>{children}</View>
    </View>
  );
}

interface ButtonProps extends PropsWithChildren {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}
export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
}: ButtonProps) {
  return (
    <NativeButton
      className={`${styles.button} ${styles[variant]}`}
      hoverClass={styles.pressed}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </NativeButton>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  password?: boolean;
  maxLength?: number;
  disabled?: boolean;
}
export function Field({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  error,
  password,
  maxLength = 140,
  disabled,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={styles.field}>
      <Label for={id} className={styles.label}>
        {label}
      </Label>
      <View
        className={`${styles.inputBox} ${focused ? styles.focused : ''} ${error ? styles.invalid : ''}`}
      >
        <Input
          id={id}
          className={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderClass={styles.placeholder}
          password={password}
          maxlength={maxLength}
          disabled={disabled}
          adjustPosition
          cursorSpacing={24}
          ariaLabel={label}
          onInput={(event) => onValueChange(event.detail.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text className={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View className={styles.card}>{children}</View>;
}
export function Stack({ children }: PropsWithChildren) {
  return <View className={styles.stack}>{children}</View>;
}
export function Title({ children, section = false }: PropsWithChildren<{ section?: boolean }>) {
  return <Text className={section ? styles.sectionTitle : styles.title}>{children}</Text>;
}
export function Body({ children, secondary = false }: PropsWithChildren<{ secondary?: boolean }>) {
  return <Text className={`${styles.body} ${secondary ? styles.mutedText : ''}`}>{children}</Text>;
}
export function Notice({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'error' | 'success' }>) {
  return (
    <View className={`${styles.notice} ${styles[tone]}`}>
      <Text>{children}</Text>
    </View>
  );
}
export function StatePanel({
  state,
  title,
  detail,
  onRetry,
}: {
  state: 'loading' | 'empty' | 'error';
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <Stack>
        {state === 'loading' ? (
          <View className={styles.skeleton}>
            <View />
            <View />
            <View />
          </View>
        ) : null}
        <Title section>{title}</Title>
        {detail ? <Body secondary>{detail}</Body> : null}
        {state === 'error' && onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            重试
          </Button>
        ) : null}
      </Stack>
    </Card>
  );
}
