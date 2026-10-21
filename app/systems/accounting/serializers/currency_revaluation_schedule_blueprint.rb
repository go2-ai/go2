module Accounting
  class CurrencyRevaluationScheduleBlueprint < Blueprinter::Base
    identifier :id

    fields :name, :rrule, :scope, :default_kind, :on_unapproved, :active,
           :last_run_status, :last_run_details, :last_revaluation_id, :created_by_id

    # ISO 8601 with offset, so browsers parse them reliably.
    %i[dtstart next_run_at last_run_at created_at updated_at].each do |attribute|
      field attribute do |schedule|
        schedule.public_send(attribute)&.iso8601
      end
    end

    # The next few occurrences, for a readable preview of the rule.
    field :upcoming_runs do |schedule|
      next [] unless schedule.active? && schedule.errors.empty?

      schedule.occurrences_after([ Time.current, schedule.dtstart - 1.second ].max, limit: 5).map(&:iso8601)
    rescue RRule::InvalidRRule
      []
    end
  end
end
