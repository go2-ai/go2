import { useEffect, useRef, useState } from 'react';
import type { Subscription } from '@rails/actioncable';
import { getCableConsumer } from '../../../app/cable';

interface UseAiChatChannelArgs {
  organizationId: number;
  chatId: number | null;
  /** Called whenever the server signals that the chat changed. */
  onChatChanged: () => void;
}

interface UseAiChatChannelResult {
  /** True while the WebSocket is open and the subscription is active. */
  connected: boolean;
}

/**
 * Subscribes to the AiChatChannel for a specific chat while the calling
 * component is mounted, and unsubscribes on unmount (or when chatId
 * changes).
 *
 * The server sends a tiny "chat_changed" signal — never chat data. The
 * `onChatChanged` callback is expected to trigger a refetch of
 * GET /chats/:id (typically by invalidating the RTK Query tag). The
 * HTTP response remains the single source of truth; the socket is
 * strictly a latency optimization.
 *
 * When chatId is null (e.g. before the chat has been created) the hook
 * does nothing.
 */
export function useAiChatChannel({
  organizationId,
  chatId,
  onChatChanged,
}: UseAiChatChannelArgs): UseAiChatChannelResult {
  const [connected, setConnected] = useState(false);

  // Keep the callback in a ref so the effect doesn't re-run when the
  // caller passes a new function identity on every render.
  const onChatChangedRef = useRef(onChatChanged);
  useEffect(() => {
    onChatChangedRef.current = onChatChanged;
  }, [onChatChanged]);

  useEffect(() => {
    if (chatId === null) return;

    const consumer = getCableConsumer();

    const subscription: Subscription = consumer.subscriptions.create(
      {
        channel: 'AiChatChannel',
        organization_id: organizationId,
        chat_id: chatId,
      },
      {
        connected() {
          setConnected(true);
        },
        disconnected() {
          setConnected(false);
        },
        rejected() {
          // Server refused the subscription (auth / ownership). Treat
          // it as "not connected" so the caller keeps polling.
          setConnected(false);
        },
        received() {
          onChatChangedRef.current();
        },
      },
    );

    return () => {
      subscription.unsubscribe();
      setConnected(false);
    };
  }, [organizationId, chatId]);

  return { connected };
}