import { requestFuzzyLocation } from '../../shared/platform/fuzzy-location';
import { ApiError } from '../../shared/api/errors';
import { weatherApi } from './api';
import type { CityOperations } from './operations';
export async function resolveCurrentCity(operation: ReturnType<CityOperations['begin']>) {
  operation.check();
  const coordinates = await requestFuzzyLocation(operation.signal);
  operation.check();
  if (!coordinates) return null;
  const context = await weatherApi.context(
    { location: { ...coordinates, coordinate_system: 'gcj02', accuracy: 'fuzzy' } },
    operation.signal,
  );
  operation.check();
  if (context.selection_source !== 'location')
    throw new ApiError('未取得可信定位城市，请手动搜索', 'invalid-response');
  return context;
}
