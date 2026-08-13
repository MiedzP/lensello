'use client';

import { Frame, Image as ImageIcon, BookOpen, Download, Package, Square } from 'lucide-react';
import { CATEGORY_LABELS, type PrintCategory } from '@/lib/prints/labels';
import { formatMinorUnits } from '@/lib/prints/money';
import { cn } from '@/lib/utils';
import type { ShopProduct } from '../page';

const CATEGORY_ICONS: Record<PrintCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  print: ImageIcon,
  framed: Frame,
  canvas: Square,
  album: BookOpen,
  wall_art: Frame,
  digital: Download,
  package: Package,
  other: Package,
};

export function ProductPicker({
  products,
  selectedId,
  onSelect,
}: {
  products: ShopProduct[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {products.map((product) => {
        const Icon = CATEGORY_ICONS[product.category];
        const isSelected = product.id === selectedId;
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product.id)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors',
              isSelected
                ? 'border-accent bg-accent-subtle'
                : 'border-subtle bg-surface hover:border-strong hover:bg-surface-hover',
            )}
          >
            <Icon size={18} className={isSelected ? 'text-accent' : 'text-muted'} aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{product.name}</span>
            <span className="text-xs text-faint">{CATEGORY_LABELS[product.category]}</span>
            <span className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {formatMinorUnits(product.price, product.currency)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
