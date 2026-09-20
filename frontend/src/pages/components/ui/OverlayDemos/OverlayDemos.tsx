import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import { DemoSection } from '../DemoSection';

export function OverlayDemos() {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  return (
    <>
      <DemoSection title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t('gallery.openDialog')}</Button>
          </DialogTrigger>
          <DialogContent closeLabel={t('gallery.close')}>
            <DialogHeader>
              <DialogTitle>{t('gallery.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('gallery.dialogDescription')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button>{t('gallery.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DemoSection>
      <DemoSection title="DropdownMenu / Popover / Tooltip">
        <div className="flex flex-wrap gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{t('gallery.openMenu')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
                {t('gallery.enable')}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">{t('gallery.openPopover')}</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverTitle>{t('gallery.popoverTitle')}</PopoverTitle>
              <PopoverDescription>{t('gallery.popoverDescription')}</PopoverDescription>
            </PopoverContent>
          </Popover>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">{t('gallery.hover')}</Button>
              </TooltipTrigger>
              <TooltipContent>{t('gallery.tooltip')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </DemoSection>
    </>
  );
}
