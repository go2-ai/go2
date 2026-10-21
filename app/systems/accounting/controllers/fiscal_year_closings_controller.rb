# app/systems/accounting/controllers/fiscal_year_closings_controller.rb
module Accounting
  # The year-end closing wizard of a fiscal year (:id is the fiscal year id).
  class FiscalYearClosingsController < ApplicationController
    before_action :set_fiscal_year

    def show
      authorize closing
      render_state
    end

    # Booked entries → approved (year must still be open).
    def approve_all
      authorize closing

      result = Accounting::Closing::ApproveAll.new(@fiscal_year, member: current_member).call
      render json: { approved: result.approved, failed: result.failed }, status: :ok
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    def start
      authorize closing

      Accounting::Closing::Starter.new(@fiscal_year, member: current_member).call
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Optional step after starting: renumber the year's entries in order.
    def renumber
      authorize closing

      Accounting::Closing::Renumberer.new(@fiscal_year, member: current_member).renumber!
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    def skip_renumber
      authorize closing

      Accounting::Closing::Renumberer.new(@fiscal_year, member: current_member).skip!
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Line description template of one kind of closing entry line, for this
    # closing (body: kind, template: { locale => text }; blank = default).
    def line_templates
      authorize closing
      return render_error(Accounting::Closing::Error.new(:not_closing)) unless @fiscal_year.closing?

      kind = params[:kind].to_s
      return render_error(Accounting::Closing::Error.new(:invalid_line_template_kind)) unless
        Accounting::Closing::LineDescriptions::KINDS.include?(kind)

      template = locale_texts_param(params[:template]) || {}
      problems = Accounting::Closing::LineDescriptions.problem_messages(template)
      return render json: { errors: problems }, status: :unprocessable_content if problems.any?

      @fiscal_year.with_lock do
        templates = (@fiscal_year.closing_data["line_templates"] || {}).merge(kind => template.compact_blank)
        @fiscal_year.update!(closing_data: @fiscal_year.closing_data.merge("line_templates" => templates))
      end
      render_state
    end

    # Accepts the remaining revaluation differences / missing rates.
    def acknowledge_revaluation
      authorize closing

      Accounting::Closing::RevaluationStep.new(@fiscal_year, member: current_member).acknowledge!
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Revaluation step → close temporary accounts.
    def complete_revaluation
      authorize closing

      Accounting::Closing::RevaluationStep.new(@fiscal_year, member: current_member).complete!
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Posts the temporary closing entries previewed with params[:checksum].
    def post_temp_closing
      authorize closing

      Accounting::Closing::TempClosing.new(@fiscal_year, member: current_member).post!(checksum: params[:checksum])
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Posts the ending entry previewed with params[:checksum].
    def post_ending
      authorize closing

      Accounting::Closing::EndingEntry.new(@fiscal_year, member: current_member).post!(checksum: params[:checksum])
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Posts the beginning entry of the next year and closes this one.
    def post_beginning
      authorize closing

      Accounting::Closing::BeginningEntry.new(@fiscal_year, member: current_member).post!
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # One step back, undoing what the previous step posted.
    def rollback
      authorize closing

      Accounting::Closing::Rollback.new(@fiscal_year).call
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    # Undoes the whole closing (also of a closed year): the year is open again.
    def reopen_fully
      authorize closing

      Accounting::Closing::Rollback.reopen_fully!(@fiscal_year)
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    def cancel
      authorize closing

      Accounting::Closing::Canceler.new(@fiscal_year).call
      render_state
    rescue Accounting::Closing::Error => e
      render_error(e)
    end

    private

    def set_fiscal_year
      @fiscal_year = current_organization.fiscal_years.find(params[:id])
    end

    def closing
      @closing ||= Accounting::FiscalYearClosing.new(@fiscal_year)
    end

    def state_json
      @fiscal_year.reload
      readiness = @fiscal_year.open? ? Accounting::Closing::Readiness.new(@fiscal_year).call : nil
      Accounting::Closing::StatePresenter.new(@fiscal_year, readiness: readiness, **step_plan).as_json
    end

    # The current step's preview. When it can't be built (e.g. an account
    # of the closing settings was deleted) the error is shown in the step,
    # so the user can still roll back or cancel.
    def step_plan
      return {} unless @fiscal_year.closing?

      case @fiscal_year.closing_step
      when "revaluation" then { revaluation_check: Accounting::Closing::RevaluationCheck.new(@fiscal_year).call }
      when "temp_closing" then { temp_closing: Accounting::Closing::TempClosing.new(@fiscal_year).plan }
      when "ending" then { ending: Accounting::Closing::EndingEntry.new(@fiscal_year).plan }
      when "beginning" then { beginning: Accounting::Closing::BeginningEntry.new(@fiscal_year).plan }
      when "renumber" then { renumber: Accounting::Closing::Renumberer.new(@fiscal_year).plan }
      else {}
      end
    rescue Accounting::Closing::Error => e
      { step_error: error_messages(e).join(" ") }
    rescue Accounting::Revaluation::Builder::Error => e # the revaluation step's dry run
      { step_error: Accounting::CurrencyRevaluation.model_t("errors.#{e.key}", **e.details.slice(:date, :fiscal_year)) }
    end

    def render_state
      render json: state_json, status: :ok
    end

    def render_error(error)
      status = error.key == :stale ? :conflict : :unprocessable_content
      render json: { errors: error_messages(error), code: error.key, details: error.details.except(:messages) }, status: status
    end

    # The error's message, then the record errors behind it (if any).
    def error_messages(error)
      message = Accounting::FiscalYearClosing.model_t("errors.#{error.key}", **error.details.slice(:fiscal_year, :date))
      [ message, *Array(error.details[:messages]) ]
    end
  end
end
