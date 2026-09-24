import { runtimeConfig } from '../../../shared/config';

// Production capabilities are limited to the actual backend contract.
// Mock mode is explicit local component demonstration, never a failure fallback.
const demo = runtimeConfig.auth.dataSource === 'mock';
export const authCapabilities = Object.freeze({
  emailCode: demo,
  passwordReset: demo,
  google: demo,
  changePassword: demo,
});
