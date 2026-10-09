import { PageHeader } from '../../components/PageHeader';
import { T } from '../../texts';

export function AccountsPage() {
  return <PageHeader title={T.accounts.title} back="/mes" />;
}
