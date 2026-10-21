# app/systems/accounting/models/currency_revaluation_schedule.rb
require "rrule"

module Accounting
  # Automatic currency revaluation on a recurrence rule (RRULE), evaluated in
  # the organization's time zone. Each run revalues the schedule's scope as
  # of the run's local date with the latest stored exchange rates. See
  # Accounting::Revaluation::ScheduledRun.
  class CurrencyRevaluationSchedule < ApplicationRecord
    include TranslationHelper
    has_paper_trail ignore: %i[next_run_at last_run_at last_run_status last_run_details last_revaluation_id updated_at]

    RUN_STATUSES = %w[posted no_change skipped blocked failed].freeze
    # Rules more frequent than this are rejected.
    ALLOWED_FREQUENCIES = %w[DAILY WEEKLY MONTHLY YEARLY].freeze

    # validate: true turns unknown values into validation errors.
    enum :default_kind, { temporary: 0, permanent: 1 }, prefix: :default, validate: true
    enum :on_unapproved, { skip: 0, post_temporary: 1, partial: 2 }, prefix: :unapproved, validate: true

    belongs_to :organization
    belongs_to :created_by, class_name: "Member", optional: true
    belongs_to :last_revaluation, class_name: "Accounting::CurrencyRevaluation", optional: true
    has_many :revaluations, class_name: "Accounting::CurrencyRevaluation", foreign_key: :schedule_id,
             inverse_of: :schedule, dependent: :nullify

    validates :name, presence: true
    validates :rrule, presence: true
    validates :dtstart, presence: true
    validates :last_run_status, inclusion: { in: RUN_STATUSES }, allow_nil: true
    validate :rrule_valid

    before_validation :normalize_rrule
    before_save :compute_next_run_at, if: -> { will_save_change_to_rrule? || will_save_change_to_dtstart? ||
                                                 will_save_change_to_active? || next_run_at.nil? }

    scope :active, -> { where(active: true) }
    scope :due, ->(now = Time.current) { active.where(next_run_at: ..now) }

    def scope_filter
      Accounting::Revaluation::Scope.new(scope)
    end

    def time_zone
      organization&.tz || ActiveSupport::TimeZone["UTC"]
    end

    # Occurrences after `after` (exclusive), as times in the organization's zone.
    def occurrences_after(after, limit: 1)
      recurrence.from(after + 1.second, limit: limit)
    end

    # The latest occurrence at or before `time`, or nil. The search starts at
    # the pending occurrence (bounded to ~a year back) so it stays cheap.
    def last_occurrence_at_or_before(time)
      start = [ dtstart, next_run_at, time - 400.days ].compact.max
      recurrence.between(start, time).last
    end

    # The local date a run at `time` revalues as of.
    def run_date(time)
      time.in_time_zone(time_zone).to_date
    end

    def recurrence
      RRule.parse(rrule, dtstart: dtstart.in_time_zone(time_zone), tzid: time_zone.tzinfo.identifier)
    end

    private

    def normalize_rrule
      self.rrule = rrule.to_s.strip.sub(/\ARRULE:/i, "").upcase.presence
    end

    def rrule_valid
      return if rrule.blank? || dtstart.blank?

      frequencies = rrule.scan(/(?:\A|;)FREQ=([A-Z]+)/).flatten
      return errors.add(:rrule, model_t("errors.invalid_rrule")) unless frequencies.one?
      unless ALLOWED_FREQUENCIES.include?(frequencies.first) && sub_daily_parts_allowed?
        return errors.add(:rrule, model_t("errors.frequency_not_allowed"))
      end

      recurrence.from(dtstart, limit: 1)
    rescue RRule::InvalidRRule, ArgumentError
      errors.add(:rrule, model_t("errors.invalid_rrule"))
    end

    # BYHOUR/BYMINUTE/BYSECOND with several values would run more than once a
    # day, so only a single value (a time of day) is accepted.
    def sub_daily_parts_allowed?
      rrule.scan(/(?:\A|;)BY(?:HOUR|MINUTE|SECOND)=([^;]*)/).flatten.none? { |value| value.include?(",") }
    end

    def compute_next_run_at
      self.next_run_at = active? ? occurrences_after([ Time.current, dtstart - 1.second ].max).first : nil
    end
  end
end
