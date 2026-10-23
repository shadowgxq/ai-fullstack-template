import { ApiError } from '../../shared/api/errors';

export interface GarmentDraft {
  name: string;
  photoMediaId: string | null;
  category: string | null;
  color: string | null;
  seasons: string[];
  occasions: string[];
  tags: string[];
  notes: string;
  expanded: boolean;
}
export function emptyGarmentDraft(): GarmentDraft {
  return {
    name: '',
    photoMediaId: null,
    category: null,
    color: null,
    seasons: [],
    occasions: [],
    tags: [],
    notes: '',
    expanded: false,
  };
}
export function toggleSelection(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
export function addCustomTag(values: readonly string[], text: string): string[] {
  const value = text.trim();
  if (!value) throw new Error('请输入标签名称');
  return values.includes(value) ? [...values] : [...values, value];
}
export function validateGarmentDraft(draft: GarmentDraft): string | null {
  return draft.name.trim() || draft.photoMediaId ? null : '请添加照片或填写衣物名称';
}

let operationSequence = 0;
export function newOperationKey(): string {
  operationSequence += 1;
  return (
    'mp-' +
    Date.now().toString(36) +
    '-' +
    operationSequence.toString(36) +
    '-' +
    Math.random().toString(36).slice(2)
  );
}

export class PendingCreate<T extends object> {
  private operation: { key: string; payload: T; fingerprint: string; uncertain: boolean } | null =
    null;
  begin(payload: T): { key: string; payload: T } {
    const fingerprint = JSON.stringify(payload);
    if (this.operation?.uncertain && this.operation.fingerprint !== fingerprint)
      throw new Error('上次保存结果尚未确认，请先重试原操作');
    if (!this.operation || this.operation.fingerprint !== fingerprint)
      this.operation = {
        key: newOperationKey(),
        payload: structuredPayload(payload),
        fingerprint,
        uncertain: false,
      };
    return this.operation;
  }
  failed(error: unknown): void {
    if (!this.operation) return;
    this.operation.uncertain = !(
      error instanceof ApiError &&
      error.kind === 'http' &&
      (error.status ?? 500) < 500
    );
  }
  get uncertain(): boolean {
    return this.operation?.uncertain ?? false;
  }
  complete(): void {
    this.operation = null;
  }
}

function structuredPayload<T extends object>(payload: T): T {
  // 只复制当前表单的 JSON 值；重试不能随受控数组后续修改而改变原请求。
  return JSON.parse(JSON.stringify(payload)) as T;
}
