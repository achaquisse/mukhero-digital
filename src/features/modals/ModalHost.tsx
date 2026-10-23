import { useState } from 'react';
import { Sheet } from '../../components/overlays/Sheet';
import { useOrgData } from '../../hooks/useOrg';
import { useUi, type ModalState } from '../../store/uiStore';
import { ExpenseDetail, LotDetail, SaleDetail } from './Details';
import { ExpenseForm } from './ExpenseForm';
import { InviteForm, NamedForm } from './SmallForms';
import { LotForm } from './LotForm';
import { ProductDetail } from './ProductDetail';
import { ProductForm } from './ProductForm';
import { QuickPicker } from './QuickPicker';
import { SaleForm } from './SaleForm';

const TITLES: Record<ModalState['kind'], string> = {
  quick: 'Registar',
  sale: 'Nova venda',
  expense: 'Nova despesa',
  lot: 'Novo lote',
  product: 'Novo produto',
  type: 'Novo tipo de produto',
  cat: 'Nova categoria de despesa',
  invite: 'Convidar membro',
  lotDetail: 'Lote',
  saleDetail: 'Detalhe da venda',
  expDetail: 'Despesa',
  productDetail: 'Produto',
};

function Body({ m }: { m: ModalState }) {
  switch (m.kind) {
    case 'quick':
      return <QuickPicker />;
    case 'sale':
      return <SaleForm productId={m.productId} />;
    case 'expense':
      return <ExpenseForm />;
    case 'lot':
      return <LotForm productId={m.productId} editId={m.editId} />;
    case 'product':
      return <ProductForm />;
    case 'type':
      return <NamedForm kind="type" />;
    case 'cat':
      return <NamedForm kind="cat" />;
    case 'invite':
      return <InviteForm />;
    case 'lotDetail':
      return <LotDetail lotId={m.lotId} />;
    case 'saleDetail':
      return <SaleDetail saleId={m.saleId} />;
    case 'expDetail':
      return <ExpenseDetail expId={m.expId} />;
    case 'productDetail':
      return <ProductDetail productId={m.productId} />;
  }
}

/** Renders the active modal; keeps the last one mounted while the sheet animates out. */
export function ModalHost() {
  const modal = useUi((s) => s.modal);
  const seq = useUi((s) => s.modalSeq);
  const close = useUi((s) => s.closeModal);
  const { derived } = useOrgData();
  const [shown, setShown] = useState<{ m: ModalState; seq: number } | null>(null);
  if (modal && shown?.m !== modal) setShown({ m: modal, seq });

  const m = modal ?? shown?.m ?? null;
  let title = m ? TITLES[m.kind] : '';
  if (m?.kind === 'lot' && m.editId) title = 'Editar lote';
  if (m?.kind === 'lotDetail') title = derived.lotById[m.lotId]?.code ?? 'Lote';

  return (
    <Sheet open={!!modal} title={title} onClose={close} wideMax={m?.kind === 'productDetail' ? 640 : 540}>
      {m && <Body key={shown?.seq ?? seq} m={m} />}
    </Sheet>
  );
}
