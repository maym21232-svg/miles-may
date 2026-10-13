# 美股研究 iOS 应用

这是现有 [美股研究网页版](https://maym21232-svg.github.io/miles-may/#/) 的 Expo/React Native 原生界面。它联网读取同一批公开 JSON 数据，提供长短线候选、模拟决策状态、公司概览和保存在设备上的自选。

## 本机开发

需要 Node.js 22.13+。在 `mobile/` 下运行：

```sh
npm install
npx expo start
```

在 iPhone 上安装 Expo Go 后扫描开发服务器二维码即可预览。电脑与手机通常需要在同一网络中。Expo Go 是开发预览容器，不是独立安装包。

## 独立 iOS 安装包

源代码已为 iOS 准备，但 Windows 本机不能用 Xcode 编译或签名。可使用 EAS 云构建。设备安装和正式分发需要 Apple Developer 账号与签名配置，尚未完成，也没有生成 `.ipa`。不要把这个目录当作已经可直接安装的成品。

## 数据与风险

- 数据从 GitHub Pages 的 `data/horizon-board.json` 和 `data/paper-portfolio.json` 获取。下拉刷新或点击刷新按钮会重新联网获取。
- 模拟决策只有在数据源状态为 `ready`、覆盖预期交易日期且报告生成于过去 36 小时内时才显示候选买卖；滞后时显示暂停，不生成新的信号。
- 历史候选和财报指标仍可研究，但不是实时行情或投资建议。完整背调继续打开网页版。
- 自选仅保存在本机，不在多个设备之间同步。
