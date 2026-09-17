# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

RUN npm install -g pnpm@10.33.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# VITE_* values are embedded in Vite's static output at build time.
ARG VITE_API_BASE_URL=/api
ARG VITE_API_TIMEOUT_MS=30000
ARG VITE_DATA_SOURCE=api
ARG VITE_RESEARCH_DATA_SOURCE=api
ARG VITE_GOOGLE_CLIENT_ID=""
# Google 登录链路：code = 自绘按钮 + OAuth 授权码流（要求后端 {code} 分支已上线且配了
# app.account.google.client-secret）；其它值/留空 = GIS ID token 流（按钮由 Google 渲染）。
# 该值在构建期被 Vite 内联并触发死代码消除，未声明 ARG 时在部署平台上设同名 service 变量
# 也进不到 pnpm build，产物会静默回落到 idtoken —— 必须在这里显式接一道。
ARG VITE_GOOGLE_AUTH_MODE=""
ARG BUILD_SOURCEMAP=false

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_TIMEOUT_MS=${VITE_API_TIMEOUT_MS}
ENV VITE_DATA_SOURCE=${VITE_DATA_SOURCE}
ENV VITE_RESEARCH_DATA_SOURCE=${VITE_RESEARCH_DATA_SOURCE}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_GOOGLE_AUTH_MODE=${VITE_GOOGLE_AUTH_MODE}
ENV BUILD_SOURCEMAP=${BUILD_SOURCEMAP}

RUN pnpm build

# ---- Serve stage ----
FROM caddy:2-alpine

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
