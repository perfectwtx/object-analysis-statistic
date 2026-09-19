import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { cn } from '../lib/cn.js';

export default function RegressionPage() {
  return (
    <div>
      <PageHeader
        title="质量回归"
        subtitle="相对基线的质量下滑检测。"
        actions={
          <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
            去分析
          </Link>
        }
      />
      <Card className="py-12 text-center text-sm text-muted-foreground">
        接口 <code className="text-xs">/api/quality/regression</code> 就绪后将在此展示。
      </Card>
    </div>
  );
}
