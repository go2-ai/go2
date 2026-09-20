# frozen_string_literal: true

module Ai
  # Raised when the provider rejects our credentials (401/403).
  class AuthenticationError < Error; end
end
