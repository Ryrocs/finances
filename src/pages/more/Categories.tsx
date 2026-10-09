import { PageHeader } from '../../components/PageHeader';
import { T } from '../../texts';

export function CategoriesPage() {
  return <PageHeader title={T.categories.title} back="/mes" />;
}
