# 桥间 · Bridge Studio

支持中英文的单人桥牌叫牌练习器。选择搭档体系，练习叫牌，查看解释并复盘。

V0.1 是具有明确覆盖范围的教学版本，**不是完整 SAYC 或通用桥牌专家引擎**。设计大纲见 [docs/v0.1.md](docs/v0.1.md)，实际规则范围见 [docs/implementation-v0.1.md](docs/implementation-v0.1.md)。

## 本地运行

需要 Node.js 20 或更高版本，无需安装依赖或执行构建：

```sh
node scripts/serve.mjs
```

打开 <http://127.0.0.1:4173/bridge-bidding-practice/>。请通过 HTTP 服务访问，直接双击 `index.html` 的 `file://` 模式无法可靠加载 ES modules。

## 已实现

- 开始练习、叫牌桌、体系配置、约定资料库、练习记录五个页面。
- 中英文切换，桌面和手机布局。
- 自由发牌、开叫、无将应叫、Stayman、转移叫训练。
- 独立配置双方体系；15–17 / 12–14 无将、五张高花设置、约定选择和冲突检测。
- 合法叫牌器、自动叫牌、四列叫牌历史、庄家与最终定约。
- 独立手牌显隐、HCP / 牌型开关、提示、撤回、重练、自动叫牌速度。
- 公开含义与本手理由分开显示；后者提前查看会标记辅助练习。
- 复盘、收藏、错题标记、笔记、浏览器本地存储。
- 体系／单副牌／完整备份的 JSON 导入导出，牌局链接分享。
- 对未覆盖进程明确停止，保留牌局供复盘。

## 测试

```sh
node --test
node --check src/app.js
```

规则测试覆盖牌张与点数守恒、叫牌合法性、加倍、庄家、转移与 Stayman 后续、配置冲突、专题生成、随机牌局和导入校验。

可选浏览器验收需要单独提供 Playwright 和浏览器。先启动本地服务，再执行：

```sh
node scripts/smoke.mjs
```

若 Playwright 不在本项目的模块搜索路径，可设置 `BRIDGE_PLAYWRIGHT` 为它的 `index.mjs` 绝对路径。可用 `BRIDGE_BROWSER` 指定 Chromium / Edge 可执行文件，`BRIDGE_URL` 覆盖测试地址。截图与临时导出文件写入已忽略的 `test-results/`。

## GitHub Pages

已提供 `.github/workflows/pages.yml`：PR 执行测试，推送到 `main` 后通过测试并部署静态资源。

首次部署：

1. 在 GitHub 仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。
2. 将代码推送到 `main`，或手动执行 `Test and deploy GitHub Pages` 工作流。
3. 部署地址为 `https://djzts.github.io/bridge-bidding-practice/`，以 Actions 实际输出为准。

所有资源使用相对路径，兼容 GitHub Pages 项目子目录。部署包仅包含 `index.html`、`favicon.svg`、`src/` 和 `.nojekyll`，不发布测试及本地数据。

## 文件结构

```text
src/
  cards.js       发牌、手牌分析、合法叫品、结束与庄家判断
  engine.js      单手信息决策、规则解释、练习发牌筛选
  systems.js     体系预设、约定目录、配置校验
  storage.js     本地保存、导入校验、牌局链接编码
  i18n.js        中英文界面文字
  app.js         页面、交互和自动叫牌调度
  styles.css     响应式界面
test/
  engine.test.js Node 内置测试
scripts/
  serve.mjs      零依赖本地 HTTP 服务
  smoke.mjs      可选浏览器验收
```

## 数据与限制

数据保存在当前网站来源的 `localStorage` 中，不跨设备同步。清除网站数据会删除本地记录，请使用完整备份。导入时验证牌张唯一性、体系、叫牌顺序与合法性，并重新计算解释；无效文件不会替换已有数据。备份导入合并记录，体系 ID 相同但内容不同时保留为新副本。

分享链接包含四家手牌和当时的体系快照，不上传到数据库。分享不包含个人笔记。隐藏手牌仅影响界面显示，不提供比赛防作弊。叫牌引擎的决策函数只接收当前牌手的一手牌。

字体有可选的 Google Fonts 增强，加载失败时使用本机字体；核心练习不调用外部 API。首次加载页面仍需要网络；此版本未实现离线安装或 Service Worker。

## English

A bilingual, browser-only bridge bidding trainer. Run `node scripts/serve.mjs` and open the local URL above. No dependency installation or build is required. The teaching engine supports a bounded subset of natural five-card-major bidding, notrump responses, Stayman and Jacoby transfers. It stops explicitly when an auction requires an unimplemented rule. All practice data stays in the current browser; JSON backups and self-contained deal links are supported.
