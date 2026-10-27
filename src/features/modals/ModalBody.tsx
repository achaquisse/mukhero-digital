import type { ModalState } from '../../store/uiStore';
import { ExpenseDetail, LotDetail, SaleDetail } from './Details';
import { ExpenseForm } from './ExpenseForm';
import { InviteForm, NamedForm } from './SmallForms';
import { LotForm } from './LotForm';
import { ProductDetail } from './ProductDetail';
import { ProductForm } from './ProductForm';
import { QuickPicker } from './QuickPicker';
import { SaleForm } from './SaleForm';

export function ModalBody({ m }: { m: ModalState }) {
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
