import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
after(() => server.close());
const { t } = await server.ssrLoadModule('/src/lib/i18n.js');
const { resizedWidth } = await server.ssrLoadModule('/src/hooks/useSidebarWidth.js');
test('工作台关键流程、动态文案和离线状态使用正确语言', () => {
  assert.equal(t('en', '上传文件'), 'Upload file'); assert.equal(t('en', '规则与运行配置'), 'Rules and runtime settings');
  assert.equal(t('en', '{0} 字符', { 0: 32 }), '32 characters');
  assert.equal(t('zh', '{0} 字符', { 0: 32 }), '32 字符');
  assert.equal(t('en', 'backendOffline'), 'Backend offline');
  assert.equal(t('en', '已请求取消分析'), 'Cancellation requested');
});
test('侧栏键盘调整有边界并支持 Home/End', () => {
  assert.equal(resizedWidth(320, 'ArrowRight'), 336); assert.equal(resizedWidth(240, 'ArrowLeft'), 240);
  assert.equal(resizedWidth(320, 'Home'), 240); assert.equal(resizedWidth(320, 'End'), 640);
});
