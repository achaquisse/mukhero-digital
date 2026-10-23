import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="m-0 flex items-center gap-1.5 text-xs font-normal text-danger">
      <Icon name="error" size={16} />
      {message}
    </p>
  );
}

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  small?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error wiring. Children receive the ids to attach. */
export function Field({ label, error, hint, className = '', small, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={`font-medium text-muted ${small ? 'text-xs' : 'text-[13px]'}`}>
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <span id={hintId} className="text-xs text-muted">
          {hint}
        </span>
      )}
      <FieldError id={errId} message={error} />
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

interface TextFieldProps extends Omit<InputProps, 'children'> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  small?: boolean;
  fieldClassName?: string;
}

export function TextField({ label, error, hint, small, fieldClassName, className = '', ...input }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} small={small} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`field ${small ? 'px-2.5! py-[9px]!' : ''} ${className}`}
          {...input}
        />
      )}
    </Field>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  label: ReactNode;
  error?: string;
};

export function TextAreaField({ label, error, className = '', ...rest }: TextAreaProps) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`field resize-y leading-[1.45] ${className}`}
          {...rest}
        />
      )}
    </Field>
  );
}

/** Numeric text input: keeps the raw string (validated by the schema) but brings up a numeric keypad. */
export function NumberField(props: TextFieldProps & { decimal?: boolean }) {
  const { decimal = true, ...rest } = props;
  return <TextField inputMode={decimal ? 'decimal' : 'numeric'} autoComplete="off" {...rest} />;
}
