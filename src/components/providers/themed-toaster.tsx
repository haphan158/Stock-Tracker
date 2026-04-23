'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  return <Toaster theme={theme} richColors closeButton position="top-right" />;
}
