import { useCallback, useRef, useState } from 'react';
import type { ConfirmTone } from '../components/ConfirmModal';

type ConfirmMeta = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmMeta & {
  open: true;
};

export function useConfirmAction() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const actionRef = useRef<(() => Promise<void>) | null>(null);

  const ask = useCallback((meta: ConfirmMeta, action: () => Promise<void>) => {
    actionRef.current = action;
    setState({ ...meta, open: true });
  }, []);

  const cancel = useCallback(() => {
    if (busy) return;
    actionRef.current = null;
    setState(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!actionRef.current || busy) return;
    setBusy(true);
    try {
      await actionRef.current();
      actionRef.current = null;
      setState(null);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return {
    ask,
    confirmProps: {
      open: state !== null,
      title: state?.title ?? '',
      description: state?.description,
      confirmLabel: state?.confirmLabel,
      tone: state?.tone,
      busy,
      onConfirm: confirm,
      onCancel: cancel,
    },
  };
}
