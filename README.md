# 美股研究 PWA

面向 iPhone 的中文美股研究网页，可筛选公司、查看财务快照并记录自选与背调笔记。基于 [crible](https://github.com/maxgfr/crible) 的 MIT 开源代码二次开发，保留原项目许可证。

## 数据边界

GitHub Pages 版本使用 crible 公开快照，并在 GitHub Actions 中生成美国交易所上市公司的静态数据。它不是实时行情或投资建议。页面标明快照和价格日期；SEC 面板在静态版只提供官方申报链接，不冒充已完成实时核验。自选和笔记仅保存在当前浏览器，不跨设备同步。

## 安装到 iPhone

部署完成后，在 iPhone Safari 打开仓库的 HTTPS Pages 地址，点“分享”再点“添加到主屏幕”。需要联网加载选股、图表和披露数据；离线时只显示连接提示，不显示可能过期的行情。

## 发布

公开仓库的 `main` 分支会触发 `.github/workflows/pages.yml`。首次部署需在仓库 Settings > Pages 中将构建来源设为 GitHub Actions。工作流会从 crible 的公开数据地址下载快照，验证后构建并发布；计划每天检查一次。失败时保留上一版已部署网站。

本地开发在 `ui/` 运行 `npm ci` 和 `npm run dev`。本地正式构建可运行 `npm run build`；若要模拟项目子路径，设置 `VITE_BASE=/仓库名/`。此仓库不包含本地数据文件、密钥或本机日志。
