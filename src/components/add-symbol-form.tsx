'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

interface AddSymbolFormProps {
  onSubmit: (symbol: string) => Promise<void> | void;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export function AddSymbolForm({
  onSubmit,
  placeholder = 'Add symbol (e.g. AAPL)',
  submitLabel = 'Add',
  disabled = false,
}: AddSymbolFormProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const symbol = value.trim().toUpperCase();
    if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
      setError('Enter a valid symbol (letters, numbers, . or -)');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(symbol);
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        aria-label="Stock symbol"
        className="sm:w-56 uppercase"
      />
      <Button type="submit" disabled={disabled || submitting || value.trim().length === 0}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
      {error ? <p className="text-sm text-red-600 self-center">{error}</p> : null}
    </form>
  );
}
