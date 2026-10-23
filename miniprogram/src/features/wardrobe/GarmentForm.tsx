import { useState } from 'react';
import { Button as NativeButton, Image, Label, Text, Textarea, View } from '@tarojs/components';
import { Button, Field, Notice } from '../../shared/ui';
import { addCustomTag, toggleSelection, type GarmentDraft } from './draft';
import { Chips, ColorChoices, ChoiceSheet, Sheet, type Choice } from './controls';
import { PrivatePhoto } from './PrivatePhoto';
import styles from './wardrobe.module.scss';
import { WardrobeIcon } from './Icon';

interface FormProps {
  draft: GarmentDraft;
  onChange: (draft: GarmentDraft) => void;
  categories: readonly Choice[];
  colors: readonly Choice[];
  seasons: readonly Choice[];
  occasions: readonly Choice[];
  tagSuggestions: readonly Choice[];
  disabled?: boolean;
  photoBusy: boolean;
  photoPreview: string | null;
  photoError: string | null;
  onPhoto: (source: 'camera' | 'album') => void;
  onRemovePhoto: () => void;
  onRetryPhoto: () => void;
  error?: string | null;
}
export function GarmentForm({
  draft,
  onChange,
  categories,
  colors,
  seasons,
  occasions,
  tagSuggestions,
  disabled = false,
  photoBusy,
  photoPreview,
  photoError,
  onPhoto,
  onRemovePhoto,
  onRetryPhoto,
  error,
}: FormProps) {
  const [sheet, setSheet] = useState<'category' | 'color' | 'tag' | null>(null);
  const [tag, setTag] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [customChoices, setCustomChoices] = useState(() => [...draft.tags]);
  const availableTags = [
    ...new Set([...tagSuggestions.map((choice) => choice.label), ...customChoices, ...draft.tags]),
  ].map((value) => ({ id: value, label: value }));
  const update = (patch: Partial<GarmentDraft>) => onChange({ ...draft, ...patch });
  const category = categories.find((option) => option.id === draft.category)?.label;
  const closeSheet = () => {
    setSheet(null);
    setTagError(null);
    setTag('');
  };
  return (
    <View className={`${styles.body} ${styles.form}`}>
      <View
        className={`${styles.photoPick} ${photoPreview || draft.photoMediaId ? styles.photoSelected : ''}`}
      >
        {photoPreview || draft.photoMediaId ? (
          <View className={styles.photoPreview}>
            {photoPreview ? (
              <Image src={photoPreview} className={styles.photo} mode="aspectFill" />
            ) : (
              <PrivatePhoto mediaId={draft.photoMediaId} />
            )}
            <NativeButton
              className={styles.removePhoto}
              ariaLabel="移除照片"
              disabled={disabled || photoBusy}
              onClick={onRemovePhoto}
            >
              ×
            </NativeButton>
          </View>
        ) : (
          <>
            <View className={styles.photoIcon}>
              <WardrobeIcon name="image-plus" tone="muted" />
            </View>
            <Text className={styles.photoTitle}>添加衣物照片</Text>
          </>
        )}
        <View className={styles.photoActions}>
          <View>
            <Button
              variant="secondary"
              disabled={disabled || photoBusy}
              onClick={() => onPhoto('camera')}
            >
              {photoPreview || draft.photoMediaId ? '重新拍照' : '拍照'}
            </Button>
          </View>
          <View>
            <Button
              variant="secondary"
              disabled={disabled || photoBusy}
              onClick={() => onPhoto('album')}
            >
              {photoPreview || draft.photoMediaId ? '从相册更换' : '从相册选择'}
            </Button>
          </View>
        </View>
        {photoBusy ? <Notice>照片上传中，请稍候</Notice> : null}
        {photoError ? (
          <>
            <Notice tone="error">{photoError}</Notice>
            <Button variant="secondary" disabled={disabled} onClick={onRetryPhoto}>
              重试上传
            </Button>
          </>
        ) : null}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        id="garment-name"
        label="衣物名称"
        value={draft.name}
        onValueChange={(name) => update({ name })}
        maxLength={120}
        disabled={disabled}
        placeholder="例如：白色棉衬衫"
      />
      <View className={styles.stack}>
        <Text className={styles.label}>衣物分类</Text>
        <NativeButton
          className={styles.trigger}
          disabled={disabled}
          onClick={() => setSheet('category')}
        >
          {category ?? '选择衣物分类'} ›
        </NativeButton>
      </View>
      <View className={styles.stack}>
        <Text className={styles.label}>主要颜色</Text>
        <ColorChoices
          options={colors}
          value={draft.color}
          disabled={disabled}
          onChange={(color) => update({ color })}
          onMore={() => setSheet('color')}
        />
      </View>
      <NativeButton
        className={styles.expander}
        disabled={disabled}
        onClick={() => update({ expanded: !draft.expanded })}
      >
        更多属性（选填） {draft.expanded ? '⌃' : '⌄'}
        <Text className={styles.caption}>季节、场合、标签与备注，按需补充</Text>
      </NativeButton>
      {draft.expanded ? (
        <>
          <View className={styles.stack}>
            <Text className={styles.label}>适用季节</Text>
            <Chips
              options={seasons}
              values={draft.seasons}
              disabled={disabled}
              onChange={(value) => update({ seasons: toggleSelection(draft.seasons, value) })}
            />
          </View>
          <View className={styles.stack}>
            <Text className={styles.label}>适用场合</Text>
            <Chips
              options={occasions}
              values={draft.occasions}
              disabled={disabled}
              onChange={(value) => update({ occasions: toggleSelection(draft.occasions, value) })}
            />
          </View>
          <View className={styles.stack}>
            <Text className={styles.label}>标签</Text>
            <Chips
              options={availableTags}
              values={draft.tags}
              disabled={disabled}
              onChange={(value) => update({ tags: toggleSelection(draft.tags, value) })}
            />
            <Button variant="secondary" disabled={disabled} onClick={() => setSheet('tag')}>
              自定义标签
            </Button>
          </View>
          <View className={styles.stack}>
            <Label for="garment-notes" className={styles.label}>
              备注
            </Label>
            <Textarea
              id="garment-notes"
              className={styles.textarea}
              value={draft.notes}
              disabled={disabled}
              maxlength={2000}
              adjustPosition
              cursorSpacing={24}
              placeholder="洗护方式、材质或其他补充信息"
              onInput={(event) => update({ notes: event.detail.value })}
            />
          </View>
        </>
      ) : null}
      <Text className={styles.caption}>照片或名称至少填写一项，其他信息可稍后补充。</Text>
      {sheet === 'category' || sheet === 'color' ? (
        <ChoiceSheet
          title={sheet === 'category' ? '选择衣物分类' : '选择主要颜色'}
          kind={sheet}
          options={sheet === 'category' ? categories : colors}
          value={sheet === 'category' ? draft.category : draft.color}
          onClose={closeSheet}
          onChoose={(value) => {
            update(sheet === 'category' ? { category: value } : { color: value });
            closeSheet();
          }}
        />
      ) : null}
      {sheet === 'tag' ? (
        <Sheet title="自定义标签" onClose={closeSheet}>
          <View className={styles.stack}>
            <Field
              id="custom-tag"
              label="标签名称"
              value={tag}
              onValueChange={setTag}
              maxLength={40}
              error={tagError ?? undefined}
            />
            <Text className={styles.caption}>添加后用于当前衣物，保存衣物后生效。</Text>
            <Button
              onClick={() => {
                try {
                  if (draft.tags.length >= 32) throw new Error('最多添加32个标签');
                  update({ tags: addCustomTag(draft.tags, tag) });
                  setCustomChoices((values) => addCustomTag(values, tag));
                  closeSheet();
                } catch (issue) {
                  setTagError(issue instanceof Error ? issue.message : '无法添加标签');
                }
              }}
            >
              添加标签
            </Button>
            <Button variant="secondary" onClick={closeSheet}>
              取消
            </Button>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
