'use client';

// Standalone AI Analyst window (opened by the pop-out button). Requires sign-in like every other page.
import { useEffect } from 'react';
import AssistantPanel from '@/components/assistant/AssistantPanel';

export default function AssistantWindowPage() {
  useEffect(() => { document.title = 'AI Analyst | Land Oracle'; }, []);
  return <AssistantPanel standalone />;
}
