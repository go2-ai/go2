# frozen_string_literal: true

module Ai
  # Raised on 429 or an explicit rate-limit signal in the body. Callers
  # may retry with backoff; the adapter itself does not retry.
  class RateLimitError < Error; end
end
