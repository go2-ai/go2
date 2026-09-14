# frozen_string_literal: true

module Ai
  # Raised on 5xx — provider-side failures. Callers may retry.
  class ServerError < Error; end
end
