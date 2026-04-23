'use client';

import { useState, type FormEvent } from 'react';

import { Check, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import {
  useCreatePortfolio,
  useDeletePortfolio,
  usePortfolios,
  useRenamePortfolio,
  type PortfolioSummaryItem,
} from '@/src/hooks/usePortfolios';

interface Props {
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
}

export function PortfolioSwitcher({ selectedId, onSelect }: Props) {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const createPortfolio = useCreatePortfolio();
  const renamePortfolio = useRenamePortfolio();
  const deletePortfolio = useDeletePortfolio();

  const [mode, setMode] = useState<'idle' | 'create' | 'rename'>('idle');
  const [draftName, setDraftName] = useState('');

  const active: PortfolioSummaryItem | undefined =
    portfolios.find((p) => p.id === selectedId) ?? portfolios.find((p) => p.isDefault);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    try {
      const result = await createPortfolio.mutateAsync(name);
      onSelect(result.portfolio.id);
      setDraftName('');
      setMode('idle');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create portfolio');
    }
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const name = draftName.trim();
    if (!name || name === active.name) {
      setMode('idle');
      return;
    }
    try {
      await renamePortfolio.mutateAsync({ id: active.id, name });
      setMode('idle');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename portfolio');
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (portfolios.length <= 1) {
      toast.error('You need at least one portfolio');
      return;
    }
    if (!confirm(`Delete portfolio "${active.name}"? Holdings in it will also be removed.`)) {
      return;
    }
    try {
      await deletePortfolio.mutateAsync(active.id);
      const remaining = portfolios.find((p) => p.id !== active.id);
      onSelect(remaining?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete portfolio');
    }
  };

  if (isLoading) {
    return <div className="bg-muted h-9 w-48 animate-pulse rounded-md" aria-busy="true" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Portfolio name"
            aria-label="New portfolio name"
            autoFocus
            className="h-9 w-48"
          />
          <Button type="submit" size="sm" disabled={createPortfolio.isPending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setMode('idle');
              setDraftName('');
            }}
          >
            Cancel
          </Button>
        </form>
      ) : mode === 'rename' && active ? (
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Portfolio name"
            aria-label="Rename portfolio"
            autoFocus
            className="h-9 w-48"
          />
          <Button type="submit" size="sm" disabled={renamePortfolio.isPending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setMode('idle');
              setDraftName('');
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <label className="sr-only" htmlFor="portfolio-select">
            Portfolio
          </label>
          <select
            id="portfolio-select"
            value={active?.id ?? ''}
            onChange={(e) => onSelect(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMode('create');
              setDraftName('');
            }}
            aria-label="Create portfolio"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          {active ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('rename');
                  setDraftName(active.name);
                }}
                aria-label={`Rename ${active.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deletePortfolio.isPending || portfolios.length <= 1}
                className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                aria-label={`Delete ${active.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
