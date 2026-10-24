module Reporting
  # Who may view or edit a report besides the holders of the general
  # permissions. Requires Reports.manage_access (or organization admin).
  class ReportGrantsController < ApplicationController
    include ReportContext

    before_action :set_organization
    before_action :set_report

    def index
      authorize @report, :manage_access?
      grants = @report.grants.where(organization: @organization).includes(:grantee).order(:grantee_type, :id)
      render json: ReportGrantBlueprint.render(grants), status: :ok
    end

    # grantee_type: Member | Role | Group | Department; access: view | edit
    def create
      authorize @report, :manage_access?
      return render_invalid_grant unless ReportGrant::GRANTEE_TYPES.include?(params[:grantee_type])

      grant = @report.grants.find_or_initialize_by(organization: @organization, grantee_type: params[:grantee_type].to_s,
                                                   grantee_id: params[:grantee_id].to_s)
      grant.access = params[:access].presence || "view"
      # Edit grants only make sense on organization reports.
      grant.access = "view" if @report.system?
      if grant.save
        render json: ReportGrantBlueprint.render(grant), status: :ok
      else
        render json: { errors: grant.errors.full_messages }, status: :unprocessable_content
      end
    rescue ActiveRecord::RecordNotUnique
      # A concurrent request granted the same grantee.
      render_invalid_grant
    end

    def destroy
      authorize @report, :manage_access?
      grant = @report.grants.where(organization: @organization).find_by(id: params[:id])
      return render json: { errors: [ controller_t("errors.not_found") ] }, status: :not_found unless grant

      grant.destroy!
      head :no_content
    end

    private

    def render_invalid_grant
      render json: { errors: [ controller_t("errors.invalid_grant") ] }, status: :unprocessable_content
    end
    def report_id_param
      :report_id
    end
  end
end
