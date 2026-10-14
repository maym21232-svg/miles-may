# 美股研究 iOS 应用

这是现有 [美股研究网页版](https://maym21232-svg.github.io/miles-may/#/) 的 Expo/React Native 原生界面。它联网读取同一批公开 JSON 数据，提供长短线候选、模拟决策状态、全市场公司搜索、按需加载的历史收盘走势和财报摘要、规则化的财报核对线索、公司档案、SEC 原始申报检索入口、本机自选和数据说明。档案与规则线索基于研究快照，不等于 SEC 核验结果或投资结论。

## 本机开发

需要 Node.js 22.13+。在 `mobile/` 下运行：

```sh
npm install
npx expo start
```

在 iPhone 上安装 Expo Go 后扫描开发服务器二维码即可预览。电脑与手机通常需要在同一网络中。Expo Go 是开发预览容器，不是独立安装包。

## 独立 iOS 安装包

源代码已为 iOS 准备，但 Windows 本机不能用 Xcode 编译或签名。`eas.json` 已配置真机内部分发和生产构建。取得 Expo 账号与 Apple Developer 签名后，在 `mobile/` 运行：

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

`preview` 使用 iOS ad hoc 配置，只能装在构建时登记的设备上。正式分发还需要 App Store/TestFlight 审核流程。当前尚未完成账号登录、设备登记和签名，也没有生成 `.ipa`；不要把这个目录当作已经可直接安装的成品。App 的 bundle identifier 暂设为 `com.maym21232svg.milesmay`，首次签名时应确认其在你的 Apple 开发者账户中可用。

## 数据与风险

- 数据从 GitHub Pages 的 `data/horizon-board.json`、`data/paper-portfolio.json` 和 `data/overview.json` 获取。列表或公司页下拉刷新会重新联网获取研究数据，公司页还会重查该股票的财报与历史价格；打开期间和回到前台时，距离上次尝试 15 分钟以上也会刷新，公司目录每天重新检查。请求超过 20 秒会报超时，用户可重试。iOS 后台不保证持续联网或实时推送。
- 最后成功获取的研究数据、公司目录以及打开过的财报和历史走势会缓存在本机，断网时可只读查看。若财报或走势的本次源数据为空，同一股票的旧资料会保留并明确标为历史缓存；从缓存载入或刷新失败后不会展示模拟买卖信号。
- 模拟决策只有在数据源状态为 `ready`、当日行情覆盖率达到 95%、覆盖预期交易日期、与设备当前所需的上一工作日一致，且报告生成于过去 36 小时内时才显示候选买卖；滞后时显示暂停，不生成新的信号。短线候选还要求整批行情及该公司的价格日期都与模拟报告一致。网页和 App 在前台每分钟重算有效性，跨过收盘门槛后无需手动刷新即可暂停旧信号。
- 设备在 20:00 UTC 后按新的工作日收盘检查，冬季可能提前约一小时暂停；这里只按工作日计算，尚未接入完整的交易所节假日和提前收盘日历。
- 历史候选和财报指标仍可研究，但不是实时行情或投资建议。完整背调继续打开网页版。
- 每日重新生成研究快照不等于上游每天提供新收盘价；数据说明页分别展示快照生成时间和典型行情日期。
- 自选仅保存在本机，不在多个设备之间同步。

## 发布前复核

`npm audit` 当前报告 Expo、React Native 及其构建链的上游依赖告警。自动建议的 Expo 44 降级与 SDK 57 不兼容，不能直接使用 `npm audit fix --force`。独立 iOS 分发前应复核对应公告、升级到兼容的修复版本，并完成真机测试。
