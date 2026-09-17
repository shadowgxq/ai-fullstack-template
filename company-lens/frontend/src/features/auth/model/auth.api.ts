import { isApiError, request } from '../../../shared/api';
import { AuthError, isAuthError, type AuthErrorCode, type AuthGateway } from './auth.gateway';
import type {
  AuthSession,
  AuthUser,
  EmailCodeLoginInput,
  GoogleLoginInput,
  PasswordLoginInput,
  RegisterInput,
  ResetPasswordInput,
  SendEmailCodeInput,
} from './auth.types';

/**
 * 真实账户 API 数据源实现。
 *
 * 契约来源：`specs/api-specs/产品服务接口文档.md` 第 6 节「账户」
 * （相对本文件所在的 frontend 工作目录是 `../specs/api-specs/产品服务接口文档.md`）。
 *
 * - 后端统一返回 `Result<T>` 信封 `{ code, message, data, timestamp }`，`code !== 200` 视为业务失败。
 * - Base URL 统一前缀 `/api/v1`；项目 `VITE_API_BASE_URL=/api`，因此这里的请求路径写 `/v1/account/...`。
 * - `email-code/send` 的响应体字段文档未给出：`AuthGateway.sendEmailCode` 契约本就是 `Promise<void>`，
 *   这里只借 `unwrapResult` 校验业务 code 是否失败，不解析、也不对外暴露 data 字段
 *   （不臆造 cooldownSeconds/expireSeconds 之类未确认字段；前端倒计时用本地固定值实现）。
 * - `password-login` 双形态共用一个路径：C 端发 `{ email, password }`（不限角色）；
 *   `{ username, password }` 仍是管理员形态（非管理员 403），本前端不发它。
 */

const ACCOUNT_BASE = '/v1/account';

export type ResultDto<TData> = {
  code: number;
  message?: string | null;
  msg?: string | null;
  errorCode?: string | null;
  data: TData;
};

/** 对应文档 6 节 `user` 对象；后端会带上前端暂不消费的字段（username/nickname/avatar/role/admin）。 */
export type AccountUserDto = {
  userId: string;
  username?: string | null;
  nickname?: string | null;
  email: string;
  avatar?: string | null;
  role: string;
  admin: boolean;
};

/** 对应文档 6 节 `LoginResponse`（email-code/login、google-login、password-login 共用）。 */
export type LoginResponseDto = {
  token: string;
  expiresIn: number;
  newUser: boolean;
  user: AccountUserDto;
};

/** 后端 AccountUserDto 收窄为前端实际消费的 AuthUser（只保留 userId、email）。 */
export function mapAccountUser(dto: AccountUserDto): AuthUser {
  return {
    userId: dto.userId,
    email: dto.email,
  };
}

export function mapLoginResponse(dto: LoginResponseDto): AuthSession {
  return {
    token: dto.token,
    expiresIn: dto.expiresIn,
    newUser: dto.newUser,
    user: mapAccountUser(dto.user),
  };
}

/** 解包 Result<T> 信封；code !== 200 视为业务失败，归一到调用方指定的 failCode。 */
export function unwrapResult<TData>(envelope: ResultDto<TData>, failCode: AuthErrorCode): TData {
  if (envelope.code !== 200) {
    throw new AuthError(failCode, envelope.message ?? envelope.msg ?? undefined, {
      apiCode: envelope.code,
      ...(envelope.errorCode ? { errorCode: envelope.errorCode } : {}),
    });
  }
  return envelope.data;
}

/**
 * 把请求层抛出的异常归一为 AuthError：
 * - 已经是 AuthError（如 unwrapResult 抛出的业务失败）原样返回；
 * - isApiError 且 HTTP 400/401（参数非法/鉴权失败）落到调用方语义化的 failCode；
 * - 其余 isApiError（如 5xx）归为 generic，但保留服务端消息；
 * - 非 API 错误（网络异常等）归为 generic，不暴露内部消息。
 */
export function toAuthError(error: unknown, failCode: AuthErrorCode): AuthError {
  if (isAuthError(error)) {
    return error;
  }
  if (isApiError(error)) {
    if (error.status === 400 || error.status === 401) {
      return new AuthError(failCode, error.message, {
        status: error.status,
        apiCode: error.code,
        ...(error.errorCode ? { errorCode: error.errorCode } : {}),
      });
    }
    return new AuthError('generic', error.message, {
      status: error.status,
      apiCode: error.code,
      ...(error.errorCode ? { errorCode: error.errorCode } : {}),
    });
  }
  return new AuthError('generic');
}

export const apiAuthGateway: AuthGateway = {
  async sendEmailCode(input: SendEmailCodeInput): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>, SendEmailCodeInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/email-code/send`,
        data: input,
      });
      unwrapResult(envelope, 'INVALID_EMAIL');
    } catch (error) {
      throw toAuthError(error, 'INVALID_EMAIL');
    }
  },

  async emailCodeLogin(input: EmailCodeLoginInput): Promise<AuthSession> {
    try {
      const envelope = await request<ResultDto<LoginResponseDto>, EmailCodeLoginInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/email-code/login`,
        data: input,
      });
      return mapLoginResponse(unwrapResult(envelope, 'INVALID_CODE'));
    } catch (error) {
      throw toAuthError(error, 'INVALID_CODE');
    }
  },

  /**
   * 密码体系三接口（2026-08-05 与后端同轮交付，契约记录见
   * docs/api/account-password-backend-gaps.md）：
   * - POST /register            {email,password}          → LoginResponse（自动登录）
   * - POST /password-login      {email,password}          → LoginResponse（C 端形态；管理员 username 形态共用同一路径）
   * - POST /password-reset/confirm {email,code,newPassword} → 成功载荷（防枚举：未注册邮箱同样成功）
   */
  async register(input: RegisterInput): Promise<AuthSession> {
    try {
      const envelope = await request<ResultDto<LoginResponseDto>, RegisterInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/register`,
        data: input,
      });
      return mapLoginResponse(unwrapResult(envelope, 'generic'));
    } catch (error) {
      // 409 是唯一需要语义化的冲突：邮箱已被占用（含验证码/Google 建的号）
      if (isApiError(error) && error.status === 409) {
        throw new AuthError('EMAIL_ALREADY_REGISTERED');
      }
      throw toAuthError(error, 'generic');
    }
  },

  async passwordLogin(input: PasswordLoginInput): Promise<AuthSession> {
    try {
      const envelope = await request<ResultDto<LoginResponseDto>, PasswordLoginInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/password-login`,
        data: input,
      });
      return mapLoginResponse(unwrapResult(envelope, 'INVALID_CREDENTIALS'));
    } catch (error) {
      throw toAuthError(error, 'INVALID_CREDENTIALS');
    }
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>, ResetPasswordInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/password-reset/confirm`,
        data: input,
      });
      unwrapResult(envelope, 'INVALID_CODE');
    } catch (error) {
      throw toAuthError(error, 'INVALID_CODE');
    }
  },

  async googleLogin(input: GoogleLoginInput): Promise<AuthSession> {
    try {
      const envelope = await request<ResultDto<LoginResponseDto>, GoogleLoginInput>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/google-login`,
        data: input,
      });
      return mapLoginResponse(unwrapResult(envelope, 'generic'));
    } catch (error) {
      throw toAuthError(error, 'generic');
    }
  },

  async logout(): Promise<void> {
    try {
      const envelope = await request<ResultDto<unknown>>({
        method: 'POST',
        url: `${ACCOUNT_BASE}/logout`,
      });
      unwrapResult(envelope, 'generic');
    } catch (error) {
      throw toAuthError(error, 'generic');
    }
  },

  async getMe(): Promise<AuthUser> {
    try {
      const envelope = await request<ResultDto<AccountUserDto>>({
        method: 'GET',
        url: `${ACCOUNT_BASE}/me`,
      });
      return mapAccountUser(unwrapResult(envelope, 'generic'));
    } catch (error) {
      throw toAuthError(error, 'generic');
    }
  },
};
