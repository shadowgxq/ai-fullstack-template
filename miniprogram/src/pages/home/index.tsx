import Taro from '@tarojs/taro';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/gateway';
import { errorMessage } from '../../shared/api/errors';
import { PageShell, Card, Stack, Title, Body, Button, Notice } from '../../shared/ui';

export default function HomePage() {
  const health = useQuery({
    queryKey: ['public', 'health'],
    queryFn: ({ signal }) => api.health(signal),
    enabled: false,
  });
  return (
    <PageShell withTabBar>
      <Stack>
        <Title>开始使用</Title>
        <Body secondary>查看基础组件，设置界面外观并连接你的服务。</Body>
      </Stack>
      <Card>
        <Stack>
          <Title section>移动端组件</Title>
          <Body secondary>表单、操作与反馈使用同一套视觉规范。</Body>
          <Button
            onClick={() => {
              void Taro.switchTab({ url: '/pages/components/index' });
            }}
          >
            查看组件
          </Button>
        </Stack>
      </Card>
      <Card>
        <Stack>
          <Title section>服务连接</Title>
          {!__API_BASE_URL__ ? (
            <Notice>尚未配置后端地址。</Notice>
          ) : (
            <Body secondary>检查服务是否可访问，不会创建或修改业务数据。</Body>
          )}
          {health.isPaused ? <Notice>当前离线，恢复网络后继续检查。</Notice> : null}
          {health.isError ? <Notice tone="error">{errorMessage(health.error)}</Notice> : null}
          {health.isSuccess ? <Notice tone="success">服务已响应</Notice> : null}
          <Button
            variant="secondary"
            disabled={!__API_BASE_URL__}
            loading={health.isFetching}
            onClick={() => {
              void health.refetch();
            }}
          >
            检查连接
          </Button>
        </Stack>
      </Card>
    </PageShell>
  );
}
