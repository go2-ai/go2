# app/systems/accounting/controllers/currency_revaluation_schedules_controller.rb
module Accounting
  # Automatic currency revaluation schedules (RRULE in the organization's time zone).
  class CurrencyRevaluationSchedulesController < ApplicationController
    before_action :set_schedule, only: %i[show update destroy run_now]

    # Validates a rule and lists its next runs without saving anything, so
    # the UI can show the same occurrences the server will use.
    # Params: rrule, dtstart.
    def preview
      authorize Accounting::CurrencyRevaluationSchedule, :index?

      schedule = Accounting::CurrencyRevaluationSchedule.new(
        organization: current_organization, name: "preview", rrule: params[:rrule],
        dtstart: parse_dtstart(params[:dtstart]) || default_dtstart
      )
      schedule.validate
      errors = %i[rrule dtstart].flat_map { |attribute| schedule.errors.full_messages_for(attribute) }
      runs = errors.empty? ? schedule.occurrences_after([ Time.current, schedule.dtstart - 1.second ].max, limit: 5) : []

      render json: {
        valid: errors.empty?,
        errors: errors,
        rrule: schedule.rrule,
        dtstart: schedule.dtstart&.in_time_zone(current_organization.tz)&.iso8601,
        upcoming_runs: runs.map(&:iso8601)
      }, status: :ok
    end

    def index
      authorize Accounting::CurrencyRevaluationSchedule

      schedules = current_organization.currency_revaluation_schedules.order(:name)
      render json: Accounting::CurrencyRevaluationScheduleBlueprint.render(schedules), status: :ok
    end

    def show
      authorize @schedule
      render_schedule
    end

    def create
      @schedule = Accounting::CurrencyRevaluationSchedule.new(organization: current_organization, created_by: current_member)
      assign_attributes
      authorize @schedule

      save_and_render
    end

    def update
      authorize @schedule
      assign_attributes

      save_and_render
    end

    def destroy
      authorize @schedule

      @schedule.destroy!
      render json: { id: @schedule.id }, status: :ok
    end

    # Runs the schedule now, as of today in the organization's time zone.
    # Doesn't change when it runs next.
    def run_now
      authorize @schedule

      result = Accounting::Revaluation::ScheduledRun.new(@schedule).call
      @schedule.reload
      render json: {
        status: result.status,
        details: result.details,
        revaluation_id: result.revaluation&.id,
        schedule: Accounting::CurrencyRevaluationScheduleBlueprint.render_as_hash(@schedule)
      }, status: :ok
    end

    private

    def set_schedule
      @schedule = current_organization.currency_revaluation_schedules.find(params[:id])
    end

    # dtstart defaults to 23:00 today in the organization's time zone, so
    # daily runs revalue each day's closing balances.
    def assign_attributes
      @schedule.assign_attributes(params.permit(:name, :rrule, :default_kind, :on_unapproved, :active))
      @schedule.dtstart = parse_dtstart(params[:dtstart]) if params[:dtstart].present?
      @schedule.dtstart ||= default_dtstart if @schedule.new_record?
      @schedule.scope = Accounting::Revaluation::Scope.new(scope_params).to_h if params.key?(:scope)
    end

    def default_dtstart
      current_organization.tz.now.beginning_of_day + 23.hours
    end

    # A date-time without an offset (e.g. "2026-10-31T23:00", as entered in
    # the UI) is a local time of the organization's time zone.
    def parse_dtstart(value)
      return nil if value.blank?

      current_organization.tz.parse(value.to_s)
    rescue ArgumentError
      nil
    end

    def scope_params
      raw = params[:scope]
      return {} if raw.blank?

      raw = raw.permit(*Accounting::Revaluation::Scope::DIMENSIONS.map { |d| { d => [] } }) if raw.respond_to?(:permit)
      raw.to_h
    end

    def save_and_render
      if @schedule.save
        render_schedule
      else
        render json: { errors: @schedule.errors.full_messages }, status: :unprocessable_content
      end
    end

    def render_schedule
      render json: Accounting::CurrencyRevaluationScheduleBlueprint.render(@schedule), status: :ok
    end
  end
end
