# 生产部署与验收

更新：2026-10-21。

## 构建与托管

使用 Node.js 22，执行 `npm ci`、`npm run check`、`npm test`、`npm run build` 和 `npm run check:bundle`。将 dist 的内容部署到站点根目录。当前路由使用 BrowserRouter，资源路径默认从 `/` 开始；子目录托管需要同时配置 Vite base 和路由 basename，不能直接将 dist 移到任意前缀下。

Vite 的开发代理不会包含在 dist 中。`vite preview` 用于本地检查构建，不作为生产服务或生产 API 代理方案。

## 同域反向代理示例

下面是 Nginx 配置示意，需替换静态目录、服务名和上传上限。此仓库未在实际生产 Nginx 中执行该配置。

```nginx
server {
    listen 80;
    root /srv/object-analyzer;
    index index.html;
    client_max_body_size 100m;

    location /api/ {
        # 不带尾部斜线，保留原始 /api 路径。
        proxy_pass http://object-analyzer-api:5200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        # 防止 SSE 进度被代理缓冲。
        proxy_buffering off;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

API 路径不能回退为 index.html，否则返回 200 的 HTML 可能被误认为接口成功。部署新版本时保留旧哈希资源一段时间，可减少已打开页面加载旧懒加载块失败的情况。

## 跨域 API

构建前设置 `VITE_API_BASE=https://api.example.com/api`。后端需要允许实际站点来源的 CORS；HTTPS 页面使用 HTTPS API，避免混合内容被浏览器拦截。

当前 EventSource 使用浏览器原生连接，没有自定义 Authorization 请求头支持。需要鉴权的部署应先对齐 Cookie、同域代理和服务端鉴权契约；不能仅在 fetch 请求里增加 Header 就假定 SSE 已接入认证。

## 本地工具链排查

- 核对 `node --version`、`Get-Command node,npm` 和 Node 安装位置。
- npm 启动器失效时，可使用已安装 Node 目录下的 npm-cli.js，或修复安装；不要下载不明启动脚本替换。
- 缓存权限受限时可指定项目内 `.npm-cache`。它已被 Git 忽略。
- 更改依赖时同步 package.json 与 package-lock.json，并验证 `npm ci`。

## 验收清单

- [ ] 直接访问并刷新 `/analyze`、`/quality/fields`、`/lineage` 能正常显示页面。
- [ ] `/assets/不存在.js` 返回 404，`/api/不存在` 返回 API 错误而非首页 HTML。
- [ ] 真实空库显示空态，没有演示作业和演示分数。
- [ ] 能力明确关闭时，导航和直接访问表现一致；未知能力保持兼容。
- [ ] 上传文件、规则校验、预检和分析采用同一后端与相同有效选项。
- [ ] SSE 进度连续可见，断开后轮询可完成或给出明确错误。
- [ ] 取消、作业切换、离开页面不会产生旧结果覆盖或持续本地轮询。
- [ ] 告警启停写入成功后刷新保持；失败时原值保留并提示。
- [ ] 中英文、四种主题、弹窗 Tab/Escape 和窄屏主要流程正常。
- [ ] CSV/Excel 导出在团队实际使用的表格软件中验证。

上述清单用于目标部署验收；未经目标环境执行的项目不应提前勾选。
