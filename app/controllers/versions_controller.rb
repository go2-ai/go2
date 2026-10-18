# app/controllers/versions_controller.rb
class VersionsController < ApplicationController
  before_action :set_organization
  before_action :authorize_organization!

  def index
    @versions = if params[:record_type] == "Accounting::JournalEntry" && params[:record_id].present?
                  # A journal entry's change log includes the changes of its items
                  journal_entry = @organization.journal_entries.find_by(id: params[:record_id])
                  return render json: { errors: [ "Record not found" ] }, status: :not_found unless journal_entry

                  own = PaperTrail::Version.where(item_type: "Accounting::JournalEntry", item_id: journal_entry.id)
                  items = Accounting::JournalEntryItem.versions_for_journal_entry(journal_entry.id)
                  PaperTrail::Version
                    .includes([ :item ])
                    .where(id: own.select(:id)).or(PaperTrail::Version.where(id: items.select(:id)))
                    .order(created_at: :desc, id: :desc)
                    .limit(params[:limit] || 200)
    elsif params[:record_type].present? && params[:record_id].present?
                  # Get versions for a specific record (timeline)
                  PaperTrail::Version
                    .includes([ :item ])
                    .where(item_type: params[:record_type], item_id: params[:record_id])
                    .order(created_at: :desc)
                    .limit(params[:limit] || 50)

    elsif params[:deleted] == "true"
                  # Get deleted records
                  @versions = PaperTrail::Version.where(event: "destroy")

                  # Optional: filter by model type
                  if params[:model_type].present?
                    @versions = @versions.where(item_type: params[:model_type])
                  end

                  @versions.order(created_at: :desc).limit(params[:limit] || 100)
    elsif params[:permission_code].present?
                  @versions = PaperTrail::Version
                    .where(item_type: "Permission")
                    .where("metadata @> ?", { organization_id: @organization.id, permission_code: params[:permission_code] }.to_json)
                    .order(created_at: :desc)

                  render json: VersionBlueprint.render(@versions, view: :permission_history), status: :ok
                  return

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
    render json: { errors: [ "Organization not found" ] }, status: :not_found unless @organization
  end

  def authorize_organization!
    authorize @organization, :administrate?
  end
end
