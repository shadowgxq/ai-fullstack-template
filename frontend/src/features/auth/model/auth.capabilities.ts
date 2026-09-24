import { runtimeConfig } from '../../../shared/config';

// Production capabilities are limited to the actual backend contract.
// Mock mode is explicit local component demonstration, never a failure fallback.
const demo = import.meta.env.DEV && runtimeConfig.auth.dataSource === 'mock';
export const authCapabilities = Object.freeze({
  emailCode: demo,
  passwordReset: demo,
  google: demo,
  changePassword: demo,
});
