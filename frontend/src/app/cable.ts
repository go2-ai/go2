import { createConsumer, type Consumer } from '@rails/actioncable';

/**
 * A single Action Cable consumer shared across the app.
 *
 * Creating a Consumer opens a WebSocket to /cable. Creating one per
 * component would open a new socket per mount (and churn under React
 * StrictMode's double-mount in dev). We create it lazily on first use
 * and reuse it for the life of the page.
 *
 * The URL is relative so the browser resolves it against the current
 * origin — same-origin cookies (including the Devise session) are sent
 * with the WebSocket upgrade request, which is what lets the server
 * authenticate the connection.
 *
 * The `createConsumer` singleton is app-level infrastructure: any
 * feature that needs a channel (AI chat, notifications, live document
 * status, ...) shares this one socket. Subscriptions are per-feature;
 * the connection is not.
 */
let cached: Consumer | null = null;

export function getCableConsumer(): Consumer {
  if (!cached) {
    cached = createConsumer('/cable');
  }
  return cached;
}