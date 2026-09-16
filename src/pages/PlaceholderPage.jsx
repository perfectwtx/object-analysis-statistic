import PageHeader from '../components/ui/PageHeader.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';

export default function PlaceholderPage({ title, subtitle, endpoint, feature }) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />
      <ApiUnavailable feature={feature || title} endpoint={endpoint} />
    </div>
  );
}
