# frozen_string_literal: true

module Ai
  # Base class for every error the AI subsystem raises. Catching
  # `Ai::Error` catches everything AI-specific without catching unrelated
  # StandardErrors from Rails or from adapters' dependencies.
  class Error < StandardError; end
end
