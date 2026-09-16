export default function LoadingBlock({ label = '加载中…' }) {
  return (
    <div className="loading-block">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
