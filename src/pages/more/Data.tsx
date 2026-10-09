import { PageHeader } from '../../components/PageHeader';
import { T } from '../../texts';

export function DataPage() {
  return <PageHeader title={T.data.title} back="/mes" />;
}
