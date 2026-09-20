# frozen_string_literal: true

module Ai
  # Raised on network-layer failures (timeouts, DNS, TLS handshake, ...).
  # Callers may retry.
  class NetworkError < Error; end
end
