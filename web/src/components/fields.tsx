import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface Common {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}

function Wrap({ id, label, error, hint, optional, children }: Common & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {children}
      {hint && !error && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
      {error && (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

const describe = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-err` : hint ? `${id}-hint` : undefined;

export function TextField({ label, error, hint, optional, className, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        className={`input ${className ?? ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error, hint)}
        {...props}
      />
    </Wrap>
  );
}

export function TextAreaField({ label, error, hint, optional, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        className="textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error, hint)}
        {...props}
      />
    </Wrap>
  );
}

export function SelectField({ label, error, hint, optional, children, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <select
        id={id}
        className="select"
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(id, error, hint)}
        {...props}
      >
        {children}
      </select>
    </Wrap>
  );
}
