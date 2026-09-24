import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 className，后出现的 Tailwind 类覆盖先出现的同族类。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
