# 🐍 Azure Multiplayer Snake Game (マルチプレイスネークゲーム)

一个基于云原生（Cloud Native）架构开发的现代多人联机贪吃蛇大作战系统。项目打通了从本地全栈开发、容器化微服务、自动化流转（CI/CD）到企业级公网云服务的完整闭环。

---

## 🚀 项目亮点 (Key Features)

- **多人实时联机**：基于 HTML5 Canvas 与高效轻量的 WebSocket 协议，支持多玩家同屏竞技，实时同步蛇体状态与食物生成。
- **全自动 CI/CD 流水线**：配置 GitHub Actions 工作流，代码一旦推送（或打上 Git Tag），全自动触发测试、镜像打包与版本控制。
- **云原生部署 (Docker & Azure)**：
  - 本地与生产环境全面容器化（Docker）。
  - 镜像托管于 **Azure Container Registry (ACR)**，并实施版本死锁与瘦身管理。
  - 核心服务托管于 **Azure Container Apps (ACA)**，外层通过企业级反向代理与负载均衡器（Envoy）确保高并发和高安全性。
- **国际化本土化 (Localization)**：前端界面全面支持日文（ja）与中文（zh-CN），完美适配多语言对战环境。
- **全方位自主调控**：PC 端支持 `1~0` 键、滑动条实时改变蛇的游走速度（Lv.1 ~ Lv.10），并提供全局随时“一时停止”（暂停）机制。

---

## 🛠️ 技术栈 (Tech Stack)

| 层次 | 技术选型 |
| :--- | :--- |
| **前端 (Frontend)** | HTML5 Canvas / JavaScript (Vanilla JS) / CSS3 (Flexbox & Grid) |
| **后端 (Backend)** | Python / Flask / Gunicorn (生产级多进程 Web 服务器) |
| **双向通信 (Network)** | WebSocket 协议 |
| **容器化 (Container)** | Docker / Docker Desktop (WSL2 / Linux VM 环境) |
| **自动化 (DevOps)** | GitHub Actions (CI/CD) / Git Tags |
| **云厂商 (Cloud)** | Microsoft Azure (Container Apps & Container Registry) |

---

## 📦 本地开发与测试指南 (Local Development)

### 前提条件
本地需安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并且保持启动状态。

### 快捷本地更新测试三连招
如果你在本地修改了代码，在终端项目根目录下顺次执行以下连招，即可无缝刷新本地测试环境：

```bash
# 1. 重新打包本地最新镜像
docker build -t tanchishe-local:latest .

# 2. 强制删除可能正占着名字的旧容器
docker rm -f test-game

# 3. 轰起新容器，并在电脑 3000 端口长驻监听
docker run -d -p 3000:3000 --name test-game tanchishe-local:latest
