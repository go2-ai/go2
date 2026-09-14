class TestSolidQueueJob < ApplicationJob
  queue_as :default

  def perform(message)
    Rails.logger.info("[TestSolidQueueJob] got: #{message}")
  end
end
