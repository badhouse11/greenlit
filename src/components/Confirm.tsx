import { useState } from 'react';
import type { ReactNode } from 'react';

interface Ask {
  title: string;
  body: ReactNode;
  confirm: string;
  onConfirm: () => void;
}

/** In-page confirmation, so nothing depends on the browser's own dialogs. */
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const dialog = ask ? (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="ask-h" onClick={() => setAsk(null)}>
      <div className="form-sheet dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="ask-h" className="t-ticket" style={{ fontSize: '1.8rem' }}>
          {ask.title}
        </h2>
        <p>{ask.body}</p>
        <div className="btn-row">
          <button
            className="btn btn--hot"
            autoFocus
            onClick={() => {
              ask.onConfirm();
              setAsk(null);
            }}
          >
            {ask.confirm}
          </button>
          <button className="btn btn--ghost" onClick={() => setAsk(null)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { confirm: setAsk, dialog };
}
