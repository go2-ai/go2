import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { UnknownAction } from '@reduxjs/toolkit';
import { skipToken, type SkipToken } from '@reduxjs/toolkit/query/react';
import type { AiChat } from '../types';
import { useAiChatChannel } from './useAiChatChannel';

/** Polling while the assistant works: a safety net when the cable is up, the only signal when it is down. */
const POLL_WITH_CABLE = 30_000;
const POLL_WITHOUT_CABLE = 2_000;

interface UseAiChatSessionArgs<Args extends { organizationId: number }> {
  /** Identifies the chat (organization, report, ...); a change gets or creates the chat again. */
  args: Args;
  /** Get-or-create mutation trigger (POST .../chats): answers with the open chat. */
  getOrCreate: (args: Args) => { unwrap: () => Promise<{ id: number }> };
  /** The chat's GET endpoint (an RTK Query endpoint: `api.endpoints.getChat`). */
  chatEndpoint: {
    useQueryState: (arg: (Args & { chatId: number }) | SkipToken) => { data?: AiChat };
    useQuerySubscription: (arg: (Args & { chatId: number }) | SkipToken, options: { pollingInterval: number }) => unknown;
  };
  /** Action that invalidates the chat's cache tag, dispatched when the cable signals a change. */
  invalidateChat: (chatId: number) => UnknownAction;
}

/**
 * An AI chat for the calling component: gets or creates it (once per
 * `args`; a superseded or unmounted request is ignored), loads it, polls
 * while the assistant is processing, and refetches when the cable says the
 * chat changed.
 *
 * Polling: off when not processing; every 30s while processing with the
 * cable connected (a silently dropped socket ends up 30 seconds late
 * rather than frozen); every 2s while processing without the cable.
 */
export function useAiChatSession<Args extends { organizationId: number }>({
  args,
  getOrCreate,
  chatEndpoint,
  invalidateChat,
}: UseAiChatSessionArgs<Args>) {
  const dispatch = useDispatch();
  const key = JSON.stringify(args);

  // Latest args and callbacks, read by the effects without re-running them.
  const latest = useRef({ args, getOrCreate, invalidateChat });
  useEffect(() => {
    latest.current = { args, getOrCreate, invalidateChat };
  });

  // One request per key, shared by a remount (StrictMode) of the same key.
  const request = useRef<{ key: string; promise: Promise<{ id: number }> } | null>(null);
  const [created, setCreated] = useState<{ key: string; chatId: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!request.current || request.current.key !== key) {
      request.current = { key, promise: latest.current.getOrCreate(latest.current.args).unwrap() };
    }
    request.current.promise
      .then((chat) => {
        if (!cancelled) setCreated({ key, chatId: chat.id });
      })
      .catch(() => {
        if (request.current?.key === key) request.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const chatId = created?.key === key ? created.chatId : null;
  const chatArg = chatId === null ? skipToken : { ...args, chatId };

  const { data: chat } = chatEndpoint.useQueryState(chatArg);
  const processing = chat?.state?.processing === true;

  const { connected } = useAiChatChannel({
    organizationId: args.organizationId,
    chatId,
    onChatChanged: () => {
      if (chatId !== null) dispatch(latest.current.invalidateChat(chatId));
    },
  });

  const pollingInterval = !processing ? 0 : connected ? POLL_WITH_CABLE : POLL_WITHOUT_CABLE;
  chatEndpoint.useQuerySubscription(chatArg, { pollingInterval });

  return { chatId, chat, processing, cableConnected: connected };
}
