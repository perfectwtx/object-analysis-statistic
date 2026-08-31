import { CHECK_LABELS } from '../utils.js';

export default function QualityPanel({ violations, bare }) {
  const pass = violations.length === 0;
  return (
    <div className={bare ? '' : 'panel quality-panel'}>
      <div className="panel-header">
        <h3>质量校验报告</h3>
        <span className={`quality-status ${pass ? 'pass' : 'fail'}`}>
          {pass ? '✓ PASS' : `✗ FAIL（${violations.length} 项违规）`}
        </span>
      </div>
      {pass ? (
        <div className="quality-pass-msg">所有规则校验通过</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>检查项</th>
                <th>违规数</th>
                <th>说明</th>
                <th>样例</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={i}>
                  <td className="mono">{v.field || <span className="dataset-tag">数据集</span>}</td>
                  <td><span className="badge violation">{CHECK_LABELS[v.check] || v.check}</span></td>
                  <td>{v.count}</td>
                  <td className="violation-msg">{v.message}</td>
                  <td>
                    {(v.samples || []).map((s) => {
                      const text = typeof s === 'string' ? s : String(s ?? '');
                      return (
                        <span className="chip" key={text}>
                          {text.length > 16 ? text.slice(0, 16) + '…' : text}
                        </span>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
