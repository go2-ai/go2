# app/controllers/versions_controller.rb
class VersionsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_organization
  before_action :authorize_organization!

  def index
    @versions = if params[:record_type].present? && params[:record_id].present?
                  # Get versions for a specific record (timeline)
                  PaperTrail::Version
                    .where(item_type: params[:record_type], item_id: params[:record_id])
                    .order(created_at: :desc)
                    .limit(params[:limit] || 50)

                elsif params[:deleted] == "true"
                  # Get deleted records
                  versions = PaperTrail::Version.where(event: "destroy")

                  # Optional: filter by model type
                  if params[:model_type].present?
                    versions = versions.where(item_type: params[:model_type])
                  end

                  versions.order(created_at: :desc).limit(params[:limit] || 100)

                else
                  # Invalid request - must specify either record_type+record_id or deleted
                  render json: { error: "Invalid request. Specify record_type and record_id, or deleted=true" },
                         status: :bad_request
                  return
                end

    render json: VersionBlueprint.render(@versions, view: :extended), status: :ok
  end

  private

  def set_organization
    @organization = Organization.find_by(id: params[:organization_id])
    render json: { errors: ["Organization not found"] }, status: :not_found unless @organization
  end

  def authorize_organization!
    authorize @organization, :administrate?
  end
end