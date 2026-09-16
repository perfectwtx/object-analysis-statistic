import { Link } from 'react-router-dom';

export default function Workbench() {
  return (
    <div className="page">
      <h1 className="page-title">分析任务</h1>
      <p className="page-subtitle">
        完整分析工作台（上传 / 规则 / 异步进度 / 结果 Tabs）请用本地
        <code> frontend-dashboard/src/workbench/Workbench.jsx </code>
        覆盖后提交；当前为占位入口。
      </p>
      <p>侧栏其它页面已接通 API Client（后端未开放时会显示约定端点）。</p>
      <Link className="btn primary" to="/quality">质量 Dashboard</Link>
    </div>
  );
}
