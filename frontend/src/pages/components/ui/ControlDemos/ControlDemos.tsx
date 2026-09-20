import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { Skeleton } from '@/shared/ui/skeleton';
import { DemoSection } from '../DemoSection';

export function ControlDemos() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  return (
    <>
      <DemoSection title="Button">
        <div className="flex flex-wrap gap-3">
          <Button>{t('gallery.primary')}</Button>
          <Button variant="outline">{t('gallery.secondary')}</Button>
          <Button disabled>{t('gallery.disabled')}</Button>
          <Button loading>{t('gallery.loading')}</Button>
        </div>
      </DemoSection>
      <DemoSection title="Input / Label / Textarea">
        <div className="space-y-2">
          <Label htmlFor="demo-input">{t('gallery.inputLabel')}</Label>
          <Input id="demo-input" placeholder={t('gallery.placeholder')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="demo-textarea">{t('gallery.notes')}</Label>
          <Textarea id="demo-textarea" placeholder={t('gallery.placeholder')} />
        </div>
      </DemoSection>
      <DemoSection title="Select">
        <Select defaultValue="first">
          <SelectTrigger aria-label={t('gallery.choose')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first">{t('gallery.first')}</SelectItem>
            <SelectItem value="second">{t('gallery.second')}</SelectItem>
          </SelectContent>
        </Select>
      </DemoSection>
      <DemoSection title="Switch / Skeleton">
        <div className="flex items-center gap-3">
          <Switch id="demo-switch" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="demo-switch">{t('gallery.enable')}</Label>
        </div>
        <div role="status" aria-label={t('gallery.loading')} className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </DemoSection>
      <DemoSection title="Tabs">
        <Tabs defaultValue="first">
          <TabsList aria-label={t('gallery.tabs')}>
            <TabsTrigger value="first">{t('gallery.first')}</TabsTrigger>
            <TabsTrigger value="second">{t('gallery.second')}</TabsTrigger>
          </TabsList>
          <TabsContent value="first">{t('gallery.firstContent')}</TabsContent>
          <TabsContent value="second">{t('gallery.secondContent')}</TabsContent>
        </Tabs>
      </DemoSection>
    </>
  );
}
