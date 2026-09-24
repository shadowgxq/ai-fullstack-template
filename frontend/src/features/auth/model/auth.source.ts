import { runtimeConfig } from '../../../shared/config';
import { apiAuthGateway } from './auth.api';
import type { AuthGateway } from './auth.gateway';
import { mockAuthGateway } from './auth.mock';

/** Single composition point; components never branch on the selected data source. */
export const authGateway: AuthGateway =
  runtimeConfig.auth.dataSource === 'mock' ? mockAuthGateway : apiAuthGateway;
