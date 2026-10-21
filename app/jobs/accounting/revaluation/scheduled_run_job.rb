# frozen_string_literal: true

module Accounting
  module Revaluation
    # Runs one occurrence of a revaluation schedule (enqueued by DispatchJob).
    class ScheduledRunJob < ApplicationJob
      queue_as :default

      def perform(schedule_id, scheduled_for)
        schedule = Accounting::CurrencyRevaluationSchedule.find_by(id: schedule_id)
        return unless schedule&.active?

        time = Time.iso8601(scheduled_for)
        # Already ran for this occurrence (e.g. the job was retried).
        return if schedule.last_run_details["scheduled_for"].present? &&
                  Time.iso8601(schedule.last_run_details["scheduled_for"]) == time

        result = ScheduledRun.new(schedule, scheduled_for: time).call
        Rails.logger.info("[Revaluation::ScheduledRunJob] schedule=#{schedule_id} status=#{result.status}")
        # TODO: notify the organization of blocked/failed runs once a notification system exists.
      end
    end
  end
end
