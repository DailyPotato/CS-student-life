# 计算机学生模拟人生 · CS LIFE

从 Hello World 到毕业答辩，一款中文校园文字养成游戏。为 GitHub Pages 制作，原生 HTML / CSS / JavaScript，无第三方运行依赖，无后端，无 API 密钥。

预定发布地址：**https://dailypotato.github.io/CS-student-life/**（只有 GitHub Pages 部署成功后此地址才可使用）。

## 开始游戏

直接打开 `index.html` 即可游玩。也可以安装 Node.js 后运行 `node server.cjs`，访问输出的本机地址。

- 8 个学期，每学期用 4 个关键周推进；每周安排 3 项行动。
- 3 种家庭背景、6 项可选天赋，开局选择 2 项。
- 13 项行动，涵盖课程、编程、算法、项目、科研、竞赛、实习、毕业设计与日常生活。
- 26 个原创校园事件，根据年级开放；每个事件提供不同选择。
- 11 种毕业结局、10 项可跨周目收集的成就。
- 每次操作后在当前浏览器自动存档，支持 JSON 导出、校验后导入。
- 支持手机、平板、电脑；不加载外部字体、图片、统计或广告。

毕业要求为至少 152 学分和 100% 毕业设计进度。期末 GPA 低于 2.0 留下一门补考，补考可追回 8 学分。大四记得在「学习」中安排毕业设计。

存档仅存于当前网址的浏览器本地空间。从本机切换到 github.io、换设备或清理网站数据前，请导出备份。成就收藏也仅保存在本机，导入存档会合并该局已有成就。浏览器不支持本地存储时，仍可游玩并导出进度。

## 发布到 GitHub Pages

目标仓库：`DailyPotato/CS-student-life`。

1. 在 GitHub 创建上述仓库。若使用 GitHub 免费个人账户，请使用公开仓库。
2. 将本文件所在目录的内容上传到仓库根目录，保留 `.github/workflows/pages.yml`，主分支使用 `main`。
3. 进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
4. 在 **Actions** 中运行 **Test and deploy to GitHub Pages**；以后推送 `main` 会自动测试并重新发布。
5. 等部署成功后，打开页面上显示的地址。预期为 `https://dailypotato.github.io/CS-student-life/`。

也可在 Pages 中选择 **Deploy from a branch → main → / (root)**，直接发布根目录的静态文件，不需要构建。此模式下可以禁用上述 Actions 发布工作流，避免并行部署。

所有资源使用相对路径，兼容项目子路径 `/CS-student-life/` 与个人主页根路径。

## 开发与验证

```text
node --test tests/engine.test.cjs
node --check app.js
node server.cjs
```

- `data.js`：课程、角色背景、天赋、行动、事件、成就配置。
- `engine.js`：与界面独立的状态机、结算、存档校验和结局规则。
- `app.js`：界面、对话框、本地存档、导入导出与渐进式 WebMCP 支持。
- `style.css`：响应式界面。
- `tests/engine.test.cjs`：行动约束、时序、存档恢复、学期结算、补考、成果与完整四年流程。

不使用网络 API，随机数状态随存档一起保存。继续同一存档会保持后续随机结果。游戏数值是简化模型，不代表真实成绩、招聘结果或个人价值。

## 创作说明

玩法方向来自用户提出的「数学系学生模拟」「医学生模拟」这类文字养成游戏：属性成长、分支事件与多结局。调研时参考了公开的相关医学生模拟项目 [学医这一生](https://github.com/K1NGzh/xueyi-yisheng) 的题材组织方式；未复用其源码、素材或事件文案。用户所指的数学系原作仓库未能确认，因此本作不声称复刻某个特定原作。

本作的界面、事件文案和游戏逻辑均为本项目新编写。
