import { translate as tx, useT } from '../lib/i18n.js';
import { Component } from 'react';

// 兜底错误边界：渲染异常时不再整页白屏，而是给出可读信息与恢复入口
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // 保留控制台堆栈，便于定位
    console.error('[render error]', error, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return <CrashView error={error} info={info} onRetry={() => this.setState({ error: null, info: null })} />;
  }
}
function CrashView({ error, info, onRetry }) {
  useT();
  return (
    <div role="alert" className="crash">
      <h2>{tx('页面渲染出错')}</h2>
      <p className="crash-msg">{error.message || String(error)}</p>
      <div className="crash-actions">
        <button className="btn" onClick={onRetry}>{tx('重试渲染')}</button>
        <button className="btn" onClick={() => window.location.reload()}>{tx('刷新页面')}</button>
      </div>
      {info?.componentStack ? <details><summary>{tx('错误详情')}</summary><pre className="crash-stack">{info.componentStack.trim()}</pre></details> : null}
    </div>
  );
}
