import { useState } from 'react';
import { Image } from '@tarojs/components';
import { chooseImage } from '../../shared/platform/wechat';
import { errorMessage } from '../../shared/api/errors';
import {
  PageShell,
  Card,
  Stack,
  Title,
  Body,
  Field,
  Button,
  Notice,
  StatePanel,
} from '../../shared/ui';
import styles from './index.module.scss';

export default function ComponentsPage() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const handleImage = async () => {
    if (choosing) return;
    setChoosing(true);
    setImageError(null);
    try {
      const path = await chooseImage();
      if (path) setImage(path);
    } catch (error) {
      setImageError(errorMessage(error));
    } finally {
      setChoosing(false);
    }
  };
  return (
    <PageShell withTabBar>
      <Stack>
        <Title>基础组件</Title>
        <Body secondary>此页展示控件状态，不提交业务数据。</Body>
      </Stack>
      <Card>
        <Stack>
          <Title section>表单</Title>
          <Field
            id="sample-name"
            label="名称"
            value={name}
            onValueChange={setName}
            placeholder="请输入名称"
            error={submitted && !name.trim() ? '请输入名称' : undefined}
          />
          <Button onClick={() => setSubmitted(true)}>校验输入</Button>
          {submitted && name.trim() ? (
            <Notice tone="success">输入格式正确，未提交到服务端。</Notice>
          ) : null}
          <Button variant="secondary" disabled>
            不可用操作
          </Button>
        </Stack>
      </Card>
      <Card>
        <Stack>
          <Title section>图片</Title>
          <Body secondary>仅预览本地图片，不会自动上传。</Body>
          {image ? <Image className={styles.image} src={image} mode="aspectFit" /> : null}
          {imageError ? <Notice tone="error">{imageError}</Notice> : null}
          <Button
            variant="secondary"
            loading={choosing}
            onClick={() => {
              void handleImage();
            }}
          >
            选择图片
          </Button>
        </Stack>
      </Card>
      <StatePanel
        state="empty"
        title="暂无内容"
        detail="空状态应说明下一步，而不是只放一张装饰图。"
      />
      <StatePanel
        state="loading"
        title="加载状态示例"
        detail="占位结构对应真实内容，避免整屏闪烁。"
      />
      <Notice tone="error">错误状态示例：操作未完成，请检查后重试。</Notice>
    </PageShell>
  );
}
