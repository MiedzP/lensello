import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getIntegrations } from '@lensello/core/integrations';
import { listProducts } from '@/lib/prints/queries';
import { ProductForm } from './components/product-form';
import { ProductTable } from './components/product-table';

export const metadata: Metadata = { title: 'Catalogue — Store' };

export default async function CataloguePage(props: PageProps<'/store/catalogue'>) {
  const { supabase } = await requireUserOrRedirect();
  const searchParams = await props.searchParams;
  const editId = typeof searchParams.edit === 'string' ? searchParams.edit : null;

  const [products, labCatalogue] = await Promise.all([
    listProducts(supabase),
    getIntegrations().printLab.catalogue(),
  ]);

  const editing = editId ? products.find((product) => product.id === editId) ?? null : null;
  const labOptions = labCatalogue.map((entry) => ({
    labSku: entry.labSku,
    name: entry.name,
    costCents: entry.costCents,
    currency: entry.currency,
  }));

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Print sizes, framing, canvas and albums the studio sells. Edits here never change what a client already paid."
        action={
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Orders
          </Link>
        }
      />

      <div className="space-y-6">
        {editing ? (
          <ProductForm product={editing} labCatalogue={labOptions} cancelHref="/store/catalogue" />
        ) : (
          <ProductForm labCatalogue={labOptions} />
        )}

        {products.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={22} aria-hidden="true" />}
            title="No products yet"
            description="Add the studio's first print size above."
          />
        ) : (
          <ProductTable products={products} />
        )}
      </div>
    </>
  );
}
