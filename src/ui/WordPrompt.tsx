import { useState } from 'react';
import { Modal } from './Modal';

export function WordPrompt({
  title,
  placeholder,
  submitLabel,
  allowEmpty,
  onSubmit,
  onCancel,
}: {
  title: string;
  placeholder: string;
  submitLabel: string;
  allowEmpty?: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const ok = allowEmpty || text.trim().length > 0;
  return (
    <Modal title={title} onClose={onCancel} className="word-prompt">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSubmit(text);
        }}
      >
        <input
          autoFocus
          className="field"
          value={text}
          maxLength={40}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="form-row">
          <small className="muted">{text.length}/40</small>
          <button className="btn btn--primary" disabled={!ok}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
