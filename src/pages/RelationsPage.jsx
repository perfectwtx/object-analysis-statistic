import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { cn } from '../lib/cn.js';

export default function RelationsPage() {
  return (
    <div>
      <PageHeader
        title="关系分析"
        subtitle="字段共现、外键候选与对象关联。需后端关系接口就绪后自动展示。"
        actions={
          <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
            去分析
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>字段关系</CardTitle>
          <CardHint>基于共现与相关性的候选关联。</CardHint>
          <p className="mt-4 text-sm text-muted-foreground">完成一次分析后，可在工作台「深度分析」查看相关性。</p>
        </Card>
        <Card>
          <CardTitle>对象关系</CardTitle>
          <CardHint>对象级引用与层级结构。</CardHint>
          <p className="mt-4 text-sm text-muted-foreground">对接 <code className="text-xs">/api/jobs/&#123;id&#125;/relationships</code> 后启用。</p>
        </Card>
      </div>
    </div>
  );
}
