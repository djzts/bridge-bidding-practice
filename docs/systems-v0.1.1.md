# V0.1.1 体系更新

三套预设可分别用于我方与敌方，提供中英文含义和叫牌理由。规则只读取行动者自己的手牌和公开叫牌历史。遇到未实现的进程明确停止，不以猜测补足体系。

## SAYC 核心版

- 五张高花、较长低花；普通开叫使用 13–21 HCP。仅计算 HCP，未实现牌型点和赢墩评估。
- 默认 1NT 15–17，可含五张高花；2NT 20–21；3NT 25–27。
- 强 2♣ 使用 22+ HCP，支持 2♦ 等待、部分积极应叫、22–24 均型再叫 2NT 及部分成局后续。
- 弱二开叫 5–11 HCP、六张套，要求至少两张 A/K/Q。
- 默认启用 Stayman、Jacoby 转移、弱二、强 2♣、Jacoby 2NT。未 Pass 过的应叫者以 13+ HCP、四张支持作 Jacoby 2NT 逼局加叫；支持短套和牌力答叫及简单成局。
- 部分自然二盖一应叫仅实现首轮逼叫；垃圾 Stayman、超接受、满贯、复杂竞争及部分再叫未覆盖，因此不能视为完整 SAYC。修改预设参数后属于自定义变体。

## 精确基础版

精确存在多种搭档约定，本版固定选择以下组合；不是对所有精确版本的兼容实现。牌型顺序为 ♠♥♦♣。

| 开叫 | 本版定义 |
| --- | --- |
| 1♣ | 16+ HCP，人工强开叫；22–24 均型优先开 2NT |
| 1♦ | 11–15，至少两张方块，排除适合其他有限开叫的牌 |
| 1♥ / 1♠ | 11–15，五张以上 |
| 1NT | 默认 13–15 均型，不含五张高花 |
| 2♣ | 11–15，六张梅花或五张梅花带四张高花；排除五张高花及本版 2♦ 牌型 |
| 2♦ | 11–15，4414 或 4405 短方块牌型 |
| 2♥ / 2♠ | 6–10 六张弱二，至少两张 A/K/Q |
| 2NT | 22–24 均型 |

强 1♣ 后：1♦ 为 0–7 否定；8+ 的五张套为自然积极应叫；1NT 为 8–13 均型且无五张套，2NT 为 14+ 均型。支持部分否定后的自然再叫和积极后的成局进程。

自然 2♣ 后支持 2♦ 问叫及部分答叫。本版短方块 2♦ 后以 11+ 的 2NT 询问牌型和强弱，逼叫一轮；以 3♥ / 3♠ / 4♣ / 4♦ 区分两种牌型及强弱。复杂接力、满贯、干扰后续和其他未列进程不在覆盖范围内。

精确不能启用自然体系的强 2♣：同一个开叫已有自然有限含义。当前 Jacoby 2NT 模块也不适用于精确有限高花开叫；配置时会说明原因。精确的弱二模块只影响高花，不覆盖人工 2♦。

## Bridge Bum 约定接入情况

**未全量导入目录。** 当前可选的五个有名称约定为 Stayman、Jacoby 转移、弱二、强 2♣、Jacoby 2NT；另有自然 2♣ 止叫和自然二阶花色止叫两个替代模块，共七项。启用受基础体系及冲突规则约束。

负加倍、Michaels 扣叫、RKCB 三项目前仅供资料查阅，不可配置为自动叫牌模块。所有模块均使用本项目编写的有限规则，不代表完整复刻来源网站。

Stayman 与自然 2♣ 止叫冲突；转移叫与自然二阶花色止叫冲突。界面阻止保存并显示同一进程含义不一致的原因。

## 练习与兼容

新增强开叫专题：精确生成强 1♣ 积极无将应叫进程；SAYC／启用强 2♣ 的教学体系生成强 2♣ 等待再叫无将进程。北家开叫，南家由用户练习。

旧浏览器存档首次升级时补充新预设，保留已有体系及选择。旧牌局继续使用其原始体系快照。升级保存后主动删除的预设不会反复补回。

验证包括 34 项 Node 测试、新体系的完整专题叫牌及导入往返、浏览器中的体系切换／强开叫／配置冲突／旧记录恢复，以及 360、390、768、1440 像素布局。

## 参考

- [ACBL SAYC System Booklet](https://web2.acbl.org/documentlibrary/play/SP3%20%28bk%29%20single%20pages.pdf)：标准体系参考；上述 HCP 简化和覆盖限制仍适用。
- [Precision 开叫讲义](https://www.whidco.com/DBAA/350_LectureSeries/DBAA_2005_Series_Defending_Precision.htm)：强梅花与有限开叫的版本参考。
- [Bridge Bum Precision 2♦](https://www.bridgebum.com/precision_2d.php)：短方块版本参考，本项目只选用上述两种牌型。
- [Bridge Bum 约定目录](https://www.bridgebum.com/bridge_bidding_conventions.php)：学习入口；并非已全部实现的功能列表。

## English

This update adds bounded SAYC core and Precision baseline presets, a strong-opening drill, strong 2♣ and Jacoby 2NT modules. Seven modules are selectable, including two natural signoff alternatives; three additional conventions remain reference-only. Precision uses the explicit opening agreements listed above. Unsupported auctions stop for review. These presets are teaching subsets, not complete system implementations. Existing custom systems and historical deal snapshots are preserved.
