# frozen_string_literal: true

module Ai
  # Raised when the client cannot build an adapter — provider unset,
  # API key missing, unknown provider name, etc.
  class ConfigurationError < Error; end
end
