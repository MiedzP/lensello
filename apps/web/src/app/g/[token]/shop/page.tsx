import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Camera } from 'lucide-react';
import { getIntegrations } from '@lensello/core/integrations';
import { currencyCode } from '@lensello/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { listGalleryPhotos, resolveGallery } from '@/lib/galleries/queries';
import { unlockCookieName, verifyUnlock } from '@/lib/galleries/unlock';
import { listActiveCatalogue, listCartItems, loadCart } from '@/lib/prints/cart';
import { cartCookieName, verifyCartCookie } from '@/lib/prints/cart-cookie';
import type { Tables } from '@/lib/db.types';
import { ShopClient } from './components/shop-client';

export type ShopProduct = Tables<'print_products'>;

export interface ShopCartItem {
  id: string;
  productName: string;
  sizeLabel: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  thumbnailUrl: string | null;
}

export const metadata: Metadata = {
  title: 'Order prints',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">{children}</div>;
}

function NotAvailable({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md py-16 text-center">
        <Camera size={26} className="mx-auto text-faint" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </Shell>
  );
}

export default async function ShopPage(props: PageProps<'/g/[token]/shop'>) {
  const { token } = await props.params;

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, token);

  if (!resolved) {
    return (
      <NotAvailable
        title="Gallery not found"
        body="This link doesn't match a gallery. Check you have the whole address, or ask your photographer to send it again."
      />
    );
  }
  if (resolved.problem === 'revoked') {
    return <NotAvailable title="This gallery is closed" body="Get in touch with the studio if you still need access." />;
  }
  if (resolved.problem === 'expired') {
    return <NotAvailable title="This link has expired" body="Ask your photographer for a fresh link." />;
  }

  const { gallery } = resolved;

  if (resolved.requiresPassword) {
    const store = await cookies();
    const unlocked = verifyUnlock(store.get(unlockCookieName(gallery.id))?.value, gallery.id, gallery.password_hash!);
    if (!unlocked) {
      return (
        <NotAvailable
          title="This gallery is password protected"
          body="Open the gallery first and enter the password — you'll be able to come straight back here."
        />
      );
    }
  }

  const [photos, products, labCatalogue] = await Promise.all([
    listGalleryPhotos(admin, gallery),
    listActiveCatalogue(admin),
    getIntegrations().printLab.catalogue(),
  ]);

  // A plain object, not a Map — simpler to pass across the server/client
  // boundary and just as easy to look up by product id.
  const minPixelsByProductId: Record<string, { width: number; height: number }> = {};
  const labBySku = new Map(labCatalogue.map((entry) => [entry.labSku, entry]));
  for (const product of products) {
    const lab = product.lab_sku ? labBySku.get(product.lab_sku) : null;
    if (lab?.minPixels) minPixelsByProductId[product.id] = lab.minPixels;
  }

  const photoByAssetId = new Map(photos.map((photo) => [photo.id, photo]));

  const store = await cookies();
  const cartOrderId = verifyCartCookie(store.get(cartCookieName(gallery.id))?.value, gallery.id);
  const cart = cartOrderId ? await loadCart(admin, cartOrderId, gallery.id) : null;
  const cartRows = cart && cart.status === 'cart' ? await listCartItems(admin, cart.id) : [];

  const cartItems: ShopCartItem[] = cartRows.map((row) => ({
    id: row.id,
    productName: row.product_name,
    sizeLabel: row.size_label,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    currency: cart?.currency ?? currencyCode(),
    thumbnailUrl: photoByAssetId.get(row.asset_id)?.url ?? null,
  }));

  return (
    <Shell>
      <header className="mb-8 text-center">
        <Camera size={24} className="mx-auto text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Order prints</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a photograph from {gallery.title || 'your gallery'} and pick how you would like it printed.
        </p>
        <Link href={`/g/${token}`} className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
          Back to the gallery
        </Link>
      </header>

      {photos.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">There are no photographs in this gallery yet.</p>
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">The studio hasn&apos;t added any products to buy yet.</p>
      ) : (
        <ShopClient
          token={token}
          photos={photos}
          products={products}
          minPixelsByProductId={minPixelsByProductId}
          initialCartItems={cartItems}
          currency={cart?.currency ?? products[0]?.currency ?? currencyCode()}
        />
      )}
    </Shell>
  );
}
