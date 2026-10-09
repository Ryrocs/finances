import { PageHeader } from '../../components/PageHeader';
import { T } from '../../texts';

export function BudgetPage() {
  return <PageHeader title={T.budget.title} back="/mes" />;
}
