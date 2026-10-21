# frozen_string_literal: true

module Accounting
  module Revaluation
    # Runs every few minutes (config/recurring.yml). For each due schedule it
    # advances next_run_at under a row lock and enqueues one ScheduledRunJob,
    # so a schedule is never run twice for the same occurrence, even when
    # dispatches overlap. Missed occurrences (e.g. downtime) are caught up
    # with a single run for the latest one.
    class DispatchJob < ApplicationJob
      queue_as :default

      def perform(now = Time.current)
        Accounting::CurrencyRevaluationSchedule.due(now).pluck(:id).each do |id|
          dispatch(id, now)
        rescue StandardError => e
          # One broken schedule must not block the others.
          Rails.logger.error("[Revaluation::DispatchJob] schedule #{id}: #{e.class}: #{e.message}")
        end
      end

      private

      def dispatch(id, now)
        scheduled_for = nil
        Accounting::CurrencyRevaluationSchedule.transaction do
          schedule = Accounting::CurrencyRevaluationSchedule.lock.find_by(id: id)
          next unless schedule&.active? && schedule.next_run_at && schedule.next_run_at <= now

          scheduled_for = schedule.last_occurrence_at_or_before(now) || schedule.next_run_at
          schedule.update_columns(next_run_at: schedule.occurrences_after(now).first, updated_at: Time.current)
        end
        ScheduledRunJob.perform_later(id, scheduled_for.utc.iso8601) if scheduled_for
      end
    end
  end
end
