import { PageHeader } from '../../components/PageHeader';
import { T } from '../../texts';

export function RecurringPage() {
  return <PageHeader title={T.recurring.title} back="/mes" />;
}
