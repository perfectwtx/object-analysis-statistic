import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 后端 ObjectAnalyzer.Api 的地址（launchSettings.json 中为 http://localhost:5200）
// 可用环境变量覆盖：API_TARGET=http://localhost:5000 npm run dev
const API_TARGET = process.env.API_TARGET || 'http://localhost:5200';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      // 前端统一请求 /api/*，由 Vite 转发到 .NET 后端，从而规避 CORS
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        // 大文件分析耗时较长，放宽超时
        timeout: 120_000,
        proxyTimeout: 120_000,
      },
    },
  },
});
