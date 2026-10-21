# app/systems/accounting/services/revaluation/scheduled_run.rb
module Accounting
  module Revaluation
    # One run of a revaluation schedule: revalues the schedule's scope as of
    # the run's local date with the latest stored rates and posts the result.
    #
    # - Runs only in open fiscal years (paused while a year is being closed).
    # - Permanent runs with balances that have unapproved entries follow the
    #   schedule's on_unapproved policy: skip (post nothing), post_temporary
    #   (post the whole run as temporary) or partial (post the rest).
    # - Nothing is posted when there are no differences ("no_change").
    #
    # The outcome is stored on the schedule (last_run_*).
    class ScheduledRun
      Result = Struct.new(:status, :revaluation, :details, keyword_init: true)

      def initialize(schedule, scheduled_for: Time.current)
        @schedule = schedule
        @scheduled_for = scheduled_for
      end

      def call
        result = perform
        record(result)
        result
      end

      private

      attr_reader :schedule, :scheduled_for

      def organization
        schedule.organization
      end

      def as_of_date
        @as_of_date ||= schedule.run_date(scheduled_for)
      end

      def base_details
        { "as_of_date" => as_of_date.iso8601, "scheduled_for" => scheduled_for.iso8601 }
      end

      def perform
        fiscal_year = organization.fiscal_years.containing(as_of_date).first
        return skipped("no_fiscal_year") unless fiscal_year
        return skipped("fiscal_year_not_open") unless fiscal_year.open?

        revaluation = Accounting::CurrencyRevaluation.create!(
          organization: organization, fiscal_year: fiscal_year, as_of_date: as_of_date,
          kind: schedule.default_kind, scope: schedule.scope_filter.to_h, schedule: schedule,
          created_by: schedule.created_by, status: :draft
        )
        prepare_and_post(revaluation)
      rescue Builder::Error => e
        discard(revaluation)
        Result.new(status: "failed", details: base_details.merge("error" => e.key.to_s))
      rescue StandardError => e
        # Recorded instead of raised: the next occurrence runs again anyway.
        Rails.logger.error("[Revaluation::ScheduledRun] schedule=#{schedule.id} #{e.class}: #{e.message}")
        discard(revaluation)
        Result.new(status: "failed", details: base_details.merge("error" => "unexpected"))
      end

      def prepare_and_post(revaluation)
        Preparer.new(revaluation).call
        blocked = count(revaluation, "blocked_by_unapproved")

        if revaluation.permanent? && blocked.positive?
          case schedule.on_unapproved
          when "skip"
            discard(revaluation)
            return Result.new(status: "blocked", details: base_details.merge("blocked" => blocked))
          when "post_temporary"
            revaluation.update!(kind: :temporary)
            Preparer.new(revaluation.reload).call
          end
        end

        details = base_details.merge(exclusion_counts(revaluation)).merge("kind" => revaluation.kind)
        if revaluation.postable_items.empty?
          discard(revaluation)
          return Result.new(status: "no_change", details: details)
        end

        Poster.new(revaluation, member: schedule.created_by).call
        Result.new(status: "posted", revaluation: revaluation,
                   details: details.merge("posted_items" => revaluation.postable_items.size))
      end

      def skipped(reason)
        Result.new(status: "skipped", details: base_details.merge("reason" => reason))
      end

      def count(revaluation, reason)
        revaluation.items.count { |item| item.excluded_reason == reason }
      end

      def exclusion_counts(revaluation)
        revaluation.items.select(&:excluded?).group_by(&:excluded_reason).transform_values(&:size)
                   .transform_keys { |reason| "excluded_#{reason}" }
      end

      def discard(revaluation)
        return unless revaluation&.persisted?

        fresh = Accounting::CurrencyRevaluation.find_by(id: revaluation.id)
        fresh.destroy! if fresh&.draft?
      end

      def record(result)
        schedule.update_columns(
          last_run_at: Time.current,
          last_run_status: result.status,
          last_run_details: result.details,
          last_revaluation_id: result.revaluation&.id || schedule.last_revaluation_id,
          updated_at: Time.current
        )
      end
    end
  end
end
