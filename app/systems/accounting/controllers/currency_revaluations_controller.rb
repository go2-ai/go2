# app/systems/accounting/controllers/currency_revaluations_controller.rb
module Accounting
  # Revaluation of foreign currency monetary items: create a draft
  # (preview), adjust it (gain/loss accounts, combinations left out, line
  # description templates), post it, or delete it with its entry.
  class CurrencyRevaluationsController < ApplicationController
    include PrintLocale

    SHOW_VIEWS = %w[show print].freeze

    before_action :set_revaluation, only: %i[show update destroy rebuild post_entry change_kind]

    def index
      authorize Accounting::CurrencyRevaluation

      revaluations = current_organization.currency_revaluations
                     .includes(:items, :journal_entry)
                     .order(as_of_date: :desc, id: :desc)
      revaluations = revaluations.where(fiscal_year_id: params[:fiscal_year_id]) if params[:fiscal_year_id].present?
      revaluations = revaluations.where(status: params[:status]) if params[:status].present?
      revaluations = revaluations.where(schedule_id: params[:schedule_id]) if params[:schedule_id].present?

      render json: Accounting::CurrencyRevaluationBlueprint.render(revaluations.limit(500)), status: :ok
    end

    # ?view=print: data for printed reports.
    def show
      authorize @revaluation
      view = params[:view].presence || "show"
      return render_errors([ model_t("errors.invalid_view") ], status: :bad_request) unless SHOW_VIEWS.include?(view)

      json = with_print_locale { Accounting::CurrencyRevaluationBlueprint.render(@revaluation, view: view.to_sym) }
      render json: json, status: :ok
    end

    # Creates a draft and computes its items (the preview).
    def create
      revaluation = Accounting::CurrencyRevaluation.new(
        organization: current_organization,
        created_by: current_member,
        kind: requested_kind || :temporary,
        status: :draft,
        as_of_date: parse_date(params[:as_of_date]) || current_organization.today,
        scope: Accounting::Revaluation::Scope.new(scope_params).to_h
      )
      assign_description(revaluation)
      assign_line_templates(revaluation)
      authorize revaluation

      revaluation.fiscal_year = fiscal_year_for(revaluation.as_of_date)
      unless revaluation.fiscal_year
        raise Accounting::Revaluation::Builder::Error.new(:no_fiscal_year, date: revaluation.as_of_date)
      end
      unless revaluation.valid?
        return render json: { errors: revaluation.errors.full_messages }, status: :unprocessable_content
      end

      Accounting::CurrencyRevaluation.transaction do
        revaluation.save!
        Accounting::Revaluation::Preparer.new(revaluation).call
      end
      @revaluation = revaluation
      render_revaluation
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e)
    rescue Date::Error
      render_errors([ model_t("errors.invalid_date") ])
    end

    # Drafts only. Changing the date, scope or kind rebuilds the items;
    # items[] sets gain/loss accounts and leaves combinations out (removed)
    # or brings them back.
    def update
      authorize @revaluation
      return render_errors([ model_t("errors.not_draft") ]) unless @revaluation.draft?

      Accounting::CurrencyRevaluation.transaction do
        rebuild = false
        if params.key?(:as_of_date)
          @revaluation.as_of_date = parse_date(params[:as_of_date])
          rebuild ||= @revaluation.as_of_date_changed?
        end
        if params.key?(:scope)
          @revaluation.scope = Accounting::Revaluation::Scope.new(scope_params).to_h
          rebuild ||= @revaluation.scope_changed?
        end
        if requested_kind
          @revaluation.kind = requested_kind
          rebuild ||= @revaluation.kind_changed?
        end
        assign_description(@revaluation)
        assign_line_templates(@revaluation)

        if rebuild
          @revaluation.fiscal_year = fiscal_year_for(@revaluation.as_of_date) || @revaluation.fiscal_year
          @revaluation.save!
          Accounting::Revaluation::Preparer.new(@revaluation).call
        else
          @revaluation.save!
          apply_item_overrides!
        end
      end
      render_revaluation
    rescue ActiveRecord::RecordInvalid => e
      render_errors(e.record.errors.full_messages)
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e)
    rescue Date::Error
      render_errors([ model_t("errors.invalid_date") ])
    end

    # Recomputes a draft from current balances and rates.
    def rebuild
      authorize @revaluation
      return render_errors([ model_t("errors.not_draft") ]) unless @revaluation.draft?

      Accounting::Revaluation::Preparer.new(@revaluation).call
      render_revaluation
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e)
    end

    def post_entry
      authorize @revaluation

      Accounting::Revaluation::Poster.new(@revaluation, member: current_member).call
      @revaluation.reload
      render_revaluation
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e, status: e.key == :stale ? :conflict : :unprocessable_content)
    end

    # Makes a posted revaluation temporary or permanent (body: kind).
    def change_kind
      authorize @revaluation

      kind = requested_kind
      return render_builder_error(Accounting::Revaluation::Builder::Error.new(:invalid_kind)) unless kind

      Accounting::Revaluation::KindToggler.new(@revaluation, kind: kind).call
      render_revaluation
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e)
    end

    def destroy
      authorize @revaluation

      Accounting::Revaluation::Remover.new(@revaluation).call
      render json: { id: @revaluation.id }, status: :ok
    rescue Accounting::Revaluation::Builder::Error => e
      render_builder_error(e)
    end

    private

    def set_revaluation
      item_includes = [ :gain_loss_account ]
      item_includes += [ :account, :currency, *(1..6).map { |level| :"center#{level}" } ] if params[:view] == "print"
      @revaluation = current_organization.currency_revaluations.includes(items: item_includes).find(params[:id])
    end

    def fiscal_year_for(date)
      return nil if date.nil?

      current_organization.fiscal_years.containing(date).first
    end

    def parse_date(value)
      value.present? ? Date.iso8601(value.to_s) : nil
    end

    def requested_kind
      kind = params[:kind].to_s
      Accounting::CurrencyRevaluation.kinds.key?(kind) ? kind : nil
    end

    def scope_params
      raw = params[:scope]
      return {} if raw.blank?

      raw = raw.permit(*Accounting::Revaluation::Scope::DIMENSIONS.map { |d| { d => [] } }) if raw.respond_to?(:permit)
      raw.to_h
    end

    def assign_description(revaluation)
      fields = t_params(:description).select { |field| params.key?(field) }
      fields.each { |field| revaluation.public_send("#{field}=", params[field]) }
    end

    # { locale => template } for the organization's languages.
    def assign_line_templates(revaluation)
      %i[line_description_template counter_line_description_template].each do |attribute|
        next unless params.key?(attribute)

        revaluation.public_send("#{attribute}=", locale_texts_param(params[attribute]) || {})
      end
    end

    # items: [{ id:, gain_loss_account_id:, removed: }] (each key optional)
    def apply_item_overrides!
      removals_changed = false
      Array(params[:items]).each do |raw|
        next unless raw.respond_to?(:key?)

        item = @revaluation.items.find(raw[:id])
        if raw.key?(:removed)
          item.removed = ActiveModel::Type::Boolean.new.cast(raw[:removed]) || false
          removals_changed ||= item.removed_changed?
        end
        assign_gain_loss_account(item, raw[:gain_loss_account_id]) if raw.key?(:gain_loss_account_id)
        item.save!
      end
      remember_removals! if removals_changed
      @revaluation.items.reset
    end

    # Exclusions from the data (no rate, unapproved entries, locked balances)
    # can't be lifted by picking another account.
    def assign_gain_loss_account(item, account_id)
      return if Accounting::Revaluation::Builder::DATA_EXCLUSIONS.include?(item.excluded_reason.to_s)

      account = account_id.present? ? fx_account!(account_id) : nil
      problem = item.difference.zero? ? nil : Accounting::Revaluation::Builder.posting_problem(item.attributes.symbolize_keys, account)
      item.assign_attributes(gain_loss_account: account, excluded: problem.present?, excluded_reason: problem)
    end

    # Keeps left-out combinations across rebuilds, including ones that have
    # no item right now (e.g. their balance is zero at the moment).
    def remember_removals!
      items = @revaluation.items.reload.to_a
      present = items.map(&:key).to_set
      kept = @revaluation.removed_key_set.reject { |key| present.include?(key) }
      @revaluation.update!(removed_keys: kept + items.select(&:removed?).map(&:key))
    end

    def fx_account!(id)
      account = Accounting::Account.includes(ledger: :account_category).find_by(id: id)
      if account.nil? || Accounting::ClosingAccounts.fx_account_error(account, current_organization)
        raise Accounting::Revaluation::Builder::Error.new(:invalid_gain_loss_account)
      end

      account
    end

    def render_revaluation
      render json: Accounting::CurrencyRevaluationBlueprint.render(@revaluation, view: :show), status: :ok
    end

    # errors: messages to show; code + details let the UI point at items.
    def render_builder_error(error, status: :unprocessable_content)
      message = model_t("errors.#{error.key}", **error.details.slice(:date, :fiscal_year))
      messages = [ message, *Array(error.details[:messages]) ]
      render json: { errors: messages, code: error.key, details: error.details.except(:messages) }, status: status
    end

    def render_errors(messages, status: :unprocessable_content)
      render json: { errors: messages }, status: status
    end

    def model_t(key, **options)
      Accounting::CurrencyRevaluation.model_t(key, **options)
    end
  end
end
