import Link from 'next/link';
import { Badge } from '@/components/ui';
import { CATEGORY_LABELS } from '@/lib/prints/labels';
import { formatMinorUnits } from '@/lib/prints/money';
import { marginCents, marginPercent } from '@/lib/prints/pricing';
import type { PrintProductRow } from '@/lib/prints/queries';
import { ActiveToggle } from './active-toggle';

function MarginCell({ product }: { product: PrintProductRow }) {
  const margin = marginCents(product.unit_cost, product.price);
  const percent = marginPercent(product.unit_cost, product.price);

  return (
    <span className={margin < 0 ? 'text-danger' : 'text-foreground'}>
      {formatMinorUnits(margin, product.currency)}
      {percent !== null ? <span className="text-faint"> ({Math.round(percent * 100)}%)</span> : null}
    </span>
  );
}

export function ProductTable({ products }: { products: PrintProductRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-subtle">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-subtle bg-surface-raised text-xs font-medium text-muted uppercase">
          <tr>
            <th className="px-4 py-2.5">Product</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Lab SKU</th>
            <th className="px-4 py-2.5 text-right">Lab cost</th>
            <th className="px-4 py-2.5 text-right">Price</th>
            <th className="px-4 py-2.5 text-right">Margin</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {products.map((product) => (
            <tr key={product.id} className={product.is_active ? undefined : 'opacity-60'}>
              <td className="px-4 py-2.5">
                <div className="font-medium text-foreground">{product.name}</div>
                <div className="text-xs text-faint">
                  {product.sku}
                  {product.size_label ? ` · ${product.size_label}` : ''}
                </div>
              </td>
              <td className="px-4 py-2.5 text-muted">{CATEGORY_LABELS[product.category]}</td>
              <td className="px-4 py-2.5 text-muted">
                {product.lab_sku ?? (product.is_digital ? <span className="text-faint">—</span> : <span className="text-warning">Not mapped</span>)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                {formatMinorUnits(product.unit_cost, product.currency)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {formatMinorUnits(product.price, product.currency)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <MarginCell product={product} />
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={product.is_active ? 'success' : 'neutral'}>
                  {product.is_active ? 'Visible' : 'Hidden'}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/store/catalogue?edit=${product.id}`}
                    className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                  <ActiveToggle productId={product.id} isActive={product.is_active} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
