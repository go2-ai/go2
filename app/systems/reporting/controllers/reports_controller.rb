module Reporting
  # The report catalog of an organization: the system presets and its own
  # reports, as far as the member may see them (see Reporting::Access).
  # Running and drilling are delegated to the report's type.
  class ReportsController < ApplicationController
    include PrintLocale
    include ReportContext
    include Accounting::ReportRunErrors
    include TranslatedParams
    before_action :set_organization

    # A concurrent copy or make-primary hit the one-primary-per-type index.
    rescue_from ActiveRecord::RecordNotUnique do
      render json: { errors: [ controller_t("errors.conflict") ] }, status: :conflict
    end
    before_action :set_report, except: [ :index ]

    def index
      authorize Reporting::Report
      reports = Reporting::Report.available_to(@organization).order(:category, :id)
      reports = reports.active unless ActiveModel::Type::Boolean.new.cast(params[:archived])
      reports = reports.where(report_type: params[:report_type]) if params[:report_type].present?
      render json: ReportBlueprint.render(access.visible(reports.to_a), access: access), status: :ok
    end

    def show
      authorize @report
      render json: ReportBlueprint.render(@report, access: access), status: :ok
    end

    # Copies a report (a system preset or one of the organization's) into
    # the organization.
    def copy
      authorize @report
      copy = Reporting::Reports::Copy.call(source: @report, organization: @organization, created_by: current_member,
                                           name: name_param.presence)
      render json: ReportBlueprint.render(copy, access: access), status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
    end

    # name / description: translated texts; primary: true makes it the
    # organization's main report of its statement type.
    def update
      authorize @report
      authorize @report, :manage? if params.key?(:primary)
      Reporting::Report.transaction do
        @report.write_attribute(:name, @report.read_attribute(:name).to_h.merge(name_param)) if name_param.present?
        if description_param.present?
          @report.write_attribute(:description, @report.read_attribute(:description).to_h.merge(description_param))
        end
        make_primary! if ActiveModel::Type::Boolean.new.cast(params[:primary])
        @report.primary = false if params.key?(:primary) && !ActiveModel::Type::Boolean.new.cast(params[:primary])
        @report.save!
      end
      render json: ReportBlueprint.render(@report, access: access), status: :ok
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
    end

    def archive
      authorize @report, :manage?
      @report.update!(archived_at: Time.current, primary: false)
      render json: ReportBlueprint.render(@report, access: access), status: :ok
    end

    def unarchive
      authorize @report, :manage?
      @report.update!(archived_at: nil)
      render json: ReportBlueprint.render(@report, access: access), status: :ok
    end

    def destroy
      authorize @report
      @report.destroy!
      head :no_content
    end

    # view=print (with locale=): the data of the report's print template,
    # in the template's language.
    def run
      authorize @report
      if params[:view] == "print"
        payload = with_print_locale do
          @report.type_definition.print(@report, organization: @organization, params: params, access: access)
        end
        return render json: payload, status: :ok
      end

      payload = @report.type_definition.run(@report, organization: @organization, params: params, access: access)
      render json: { report: ReportBlueprint.render_as_hash(@report, access: access), **payload }, status: :ok
    end

    def drill
      authorize @report
      payload = @report.type_definition.drill(@report, organization: @organization, params: params, access: access)
      render json: payload, status: :ok
    rescue ActiveRecord::RecordNotFound
      render json: { errors: [ controller_t("errors.not_found") ] }, status: :not_found
    end

    private

    def make_primary!
      Reporting::Report.where(organization: @organization, statement_type: @report.statement_type, primary: true)
                       .where.not(id: @report.id).find_each { |report| report.update!(primary: false) }
      @report.primary = true
    end

    def name_param
      @name_param ||= translated_param(:name, organization: @organization)
    end

    def description_param
      @description_param ||= translated_param(:description, organization: @organization)
    end
  end
end
