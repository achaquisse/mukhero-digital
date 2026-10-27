import { useEffect, useState } from 'react';
import { Sheet } from '../../components/overlays/Sheet';
import { Spinner } from '../../components/ui/Spinner';
import { useOrgData } from '../../hooks/useOrg';
import { useUi, type ModalState } from '../../store/uiStore';
import { loadedModalBody, loadModalBody } from './loadModalBody';

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

/** Renders the active modal; keeps the last one mounted while the sheet animates out. */
export function ModalHost() {
  const modal = useUi((s) => s.modal);
  const seq = useUi((s) => s.modalSeq);
  const close = useUi((s) => s.closeModal);
  const { derived } = useOrgData();
  const [shown, setShown] = useState<{ m: ModalState; seq: number } | null>(null);
  const [Body, setBody] = useState(loadedModalBody);
  const [failed, setFailed] = useState(false);
  if (modal && shown?.m !== modal) setShown({ m: modal, seq });

  useEffect(() => {
    if (Body || (failed && !modal)) return;
    loadModalBody().then(
      (b) => setBody(() => b),
      () => setFailed(true),
    );
  }, [Body, failed, modal]);

  const m = modal ?? shown?.m ?? null;
  let title = m ? TITLES[m.kind] : '';
  if (m?.kind === 'lot' && m.editId) title = 'Editar lote';
  if (m?.kind === 'lotDetail') title = derived.lotById[m.lotId]?.code ?? 'Lote';

  return (
    <Sheet open={!!modal} title={title} onClose={close} wideMax={m?.kind === 'productDetail' ? 640 : 540}>
      {m && (Body ? <Body key={shown?.seq ?? seq} m={m} /> : <Spinner />)}
    </Sheet>
  );
}
