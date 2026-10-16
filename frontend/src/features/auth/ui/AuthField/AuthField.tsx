import { useState, type ReactNode } from 'react';

import { Eye, EyeOff, type LucideIcon } from '@/shared/icons';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/utils/cn';

export type AuthFieldProps = {
  id: string;
  type: 'text' | 'email' | 'password';
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** 有值即视为校验失败：渲染错误行并接上 aria-invalid / aria-describedby。 */
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** 只读字段：值由上层决定且不允许改（例如改密页里锁定的账号邮箱）。 */
  readOnly?: boolean;
  /** 渲染在输入框内左侧的装饰图标。 */
  icon?: LucideIcon;
  /** 密码字段的可见性切换标签；只有 type='password' 时才渲染切换按钮。 */
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
  /** 渲染在输入框右侧同一排的操作，例如「发送验证码」。 */
  action?: ReactNode;
};

/**
 * 账户表单字段。Input、Label 与密码操作按钮均复用 shared/ui primitive，
 * 认证字号与图标位置按认证组合覆盖，字段状态仍由 Input 提供。
 *
 * 无障碍语义：label 经 htmlFor 关联输入框，错误行 id 固定为 `${id}-error`
 * 并由 aria-describedby 指向，出错时 aria-invalid 置位。
 */
export function AuthField({
  id,
  type,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  disabled,
  readOnly,
  icon: Icon,
  showPasswordLabel,
  hidePasswordLabel,
  action,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const errorId = id + '-error';

  const inputControl = (
    <div className="relative flex min-w-0 flex-1 items-center">
      {Icon ? (
        <Icon
          className="pointer-events-none absolute left-[var(--space-3)] z-10 size-[var(--icon-size-md)] text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
      <Input
        id={id}
        type={isPassword && revealed ? 'text' : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          'text-[length:var(--font-size-lg)] leading-[1.25]',
          Icon &&
            'pl-[calc(var(--space-3)+var(--icon-size-md)+var(--space-2)-var(--control-border-width))]',
          isPassword &&
            'pr-[calc(var(--space-3)+var(--icon-size-md)+var(--space-2)-var(--control-border-width))]',
          // 只读不是禁用：内容仍可选中复制、仍进 tab 序，只是不接受编辑。
          readOnly && 'bg-muted',
        )}
      />
      {isPassword ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-[var(--space-1)] -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
          disabled={disabled}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="group flex flex-col gap-[var(--space-2)]" data-disabled={disabled || undefined}>
      <Label htmlFor={id} className="text-[length:var(--font-size-lg)] leading-[1.25]">
        {label}
      </Label>
      {action ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--space-2)]">
          {inputControl}
          {action}
        </div>
      ) : (
        inputControl
      )}
      {error ? (
        <p
          id={errorId}
          className="text-[length:var(--font-size-xs)] leading-[var(--caption-leading)] text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
