import { readFile, mkdir, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const source = new URL('../../docs/contracts/generated/backend.openapi.json', import.meta.url);
const output = new URL('../src/shared/api/schema.generated.ts', import.meta.url);
const text =
  '// Generated from backend OpenAPI; do not edit.\n' +
  astToString(await openapiTS(source, { alphabetize: true }));
if (process.argv.includes('--check')) {
  const existing = await readFile(output, 'utf8').catch(() => '');
  if (existing !== text) throw new Error('API 类型有漂移：运行 pnpm contracts 并审查 diff');
} else {
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, text);
}
