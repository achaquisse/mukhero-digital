import { IconTile } from '../../components/ui/Display';
import { useUi, type ModalState } from '../../store/uiStore';

const ITEMS: Array<[ModalState, string, string, string]> = [
  [{ kind: 'sale' }, 'Venda', 'Sai do stock por FIFO', 'point_of_sale'],
  [{ kind: 'expense' }, 'Despesa', 'Renda, transporte…', 'receipt_long'],
  [{ kind: 'lot' }, 'Lote', 'Nova importação', 'local_shipping'],
  [{ kind: 'product' }, 'Produto', 'Catálogo e preço', 'category'],
];

export function QuickPicker() {
  const openModal = useUi((s) => s.openModal);
  return (
    <div className="grid grid-cols-2 gap-2">
      {ITEMS.map(([m, label, sub, icon], i) => (
        <button
          key={label}
          type="button"
          onClick={() => openModal(m)}
          className="flex items-center gap-3 rounded-xl border border-[#E7E9EE] bg-white p-3.5 text-left text-ink hover:bg-[#FAFBFC]"
        >
          <IconTile icon={icon} tint={i} size={38} />
          <span className="flex flex-col gap-px">
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted">{sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
