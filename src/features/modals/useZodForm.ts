import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

/** react-hook-form bound to a Zod schema, with separate input/output types. */
export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
  opts: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, 'resolver'>,
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    // The resolver's overloads can't see through the generic; types are pinned by useForm's params.
    resolver: zodResolver(schema as never) as never,
    mode: 'onTouched',
    ...opts,
  });
}
