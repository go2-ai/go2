# frozen_string_literal: true

module Ai
  # Raised when a provider returns a response we can't parse or that is
  # structurally wrong (missing expected keys, non-JSON body, etc.).
  class ResponseParseError < Error; end
end
