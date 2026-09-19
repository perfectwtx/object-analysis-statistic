import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { cn } from '../lib/cn.js';

export default function ObjectRelationshipsPage() {
  return (
    <div>
      <PageHeader
        title="对象关系"
        subtitle="对象之间的引用与聚合结构。"
        actions={
          <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
            去分析
          </Link>
        }
      />
      <Card className="py-12 text-center text-sm text-muted-foreground">
        等待后端关系接口。可先在分析工作台查看字段相关性。
      </Card>
    </div>
  );
}
