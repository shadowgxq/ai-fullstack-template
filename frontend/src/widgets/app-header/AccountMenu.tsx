import { useTranslation } from 'react-i18next';

import { useChangePasswordModal, authCapabilities } from '../../features/auth';
import { ChevronDown, KeyRound, LogOut, UserRound } from '@/shared/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export type AccountMenuProps = {
  accountName: string;
  isAdmin?: boolean;
  onLogout: () => void;
  logoutPending?: boolean;
};

export function AccountMenu({
  accountName,
  isAdmin = false,
  onLogout,
  logoutPending = false,
}: AccountMenuProps) {
  const { t } = useTranslation();
  const openChangePassword = useChangePasswordModal((state) => state.openChangePassword);
  const accountMenuLabel = t('header.accountLabel');
  const displayName = accountName || accountMenuLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground focus-visible:ring-ring inline-flex min-h-10 items-center gap-[7px] rounded-md border border-transparent bg-transparent px-2 py-0 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label={displayName}
          title={displayName}
        >
          <UserRound className="shrink-0" size={18} aria-hidden="true" />
          <span className="max-w-[min(4rem,14vw)] truncate">{displayName}</span>
          <ChevronDown
            className="shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180"
            size={15}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        aria-label={accountMenuLabel}
        className="w-[min(232px,calc(100vw-24px))] min-w-0"
      >
        <DropdownMenuLabel className="grid min-w-0 gap-[3px] border-border-subtle border-b p-0 px-[7px] pt-[5px] pb-[10px] font-normal">
          {/* 标签靠左、角色徽章靠右，中间留白由 justify-between 撑开；
              两者相邻排列时会挤在一起，读起来像一个词组。 */}
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wide">
              {accountMenuLabel}
            </span>
            {isAdmin ? (
              <span className="border-primary/30 bg-secondary text-secondary-foreground inline-flex min-h-[22px] shrink-0 items-center rounded-full border px-[7px] py-0 text-xs font-medium">
                {t('header.adminRole')}
              </span>
            ) : null}
          </span>
          <span className="text-foreground block truncate text-sm font-medium" title={displayName}>
            {displayName}
          </span>
        </DropdownMenuLabel>

        <div className="grid gap-0.5 pt-1.5">
          {authCapabilities.changePassword ? (
            <DropdownMenuItem className="w-full text-left" onSelect={openChangePassword}>
              <KeyRound size={16} aria-hidden="true" />
              <span>{t('header.changePassword')}</span>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={logoutPending}
            className="w-full text-left"
            onSelect={onLogout}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{t('auth.logout')}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
