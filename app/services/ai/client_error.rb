# frozen_string_literal: true

module Ai
  # Raised on 4xx (other than 401/403/429) — bad request, invalid model
  # name, etc. Not retryable.
  class ClientError < Error; end
end
