import Taro from '@tarojs/taro';
import { onlineManager } from '@tanstack/react-query';

/** 小程序没有 window online/offline；应用只安装一次，退出时成对移除监听。 */
export function bindNetworkStatus(): () => void {
  let active = true;
  let receivedEvent = false;
  const onChange = (status: { isConnected: boolean }) => {
    receivedEvent = true;
    if (active) onlineManager.setOnline(status.isConnected);
  };
  Taro.onNetworkStatusChange(onChange);
  void Taro.getNetworkType()
    .then((result) => {
      if (active && !receivedEvent) onlineManager.setOnline(result.networkType !== 'none');
    })
    .catch(() => {
      // 读状态失败不制造离线结论；真实 request 仍返回网络错误。
    });
  return () => {
    active = false;
    Taro.offNetworkStatusChange(onChange);
  };
}
