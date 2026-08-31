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

    return (
      <div className="crash">
        <h2>页面渲染出错</h2>
        <p className="crash-msg">{error.message || String(error)}</p>
        {info?.componentStack && (
          <pre className="crash-stack">{info.componentStack.trim()}</pre>
        )}
        <div className="crash-actions">
          <button className="btn" onClick={() => this.setState({ error: null, info: null })}>
            重试渲染
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
        <p className="crash-hint">
          如果是分析某个数据源后出现的，多半是后端与本地引擎的字段结构不一致；切换到另一个引擎可临时绕过。
        </p>
      </div>
    );
  }
}
