# frozen_string_literal: true

module Accounting
  module ExchangeRates
    # Fetches the latest provider rates. Without an organization id, fans
    # out one job per organization that has an active provider source
    # (scheduled daily in config/recurring.yml). A failure for one
    # organization doesn't affect the others.
    class FetchJob < ApplicationJob
      queue_as :default

      def perform(organization_id = nil)
        if organization_id.nil?
          organization_ids_with_provider_sources.each { |id| self.class.perform_later(id) }
          return
        end

        organization = Organization.find_by(id: organization_id)
        return unless organization

        result = Fetcher.new(organization: organization).call
        Rails.logger.info(
          "[ExchangeRates::FetchJob] organization=#{organization_id} " \
          "created=#{result.created} updated=#{result.updated} skipped=#{result.skipped.size}"
        )
      rescue Providers::Ecb::Error => e
        # Logged and dropped: the next scheduled run fetches again.
        # TODO: notify the organization once a notification system exists.
        Rails.logger.warn("[ExchangeRates::FetchJob] organization=#{organization_id} #{e.message}")
      end

      private

      def organization_ids_with_provider_sources
        Accounting::ExchangeRateSource.active
                                      .where.not(provider: Accounting::ExchangeRate::MANUAL)
                                      .distinct
                                      .pluck(:organization_id)
      end
    end
  end
end
