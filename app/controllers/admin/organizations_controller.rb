module Admin
  class OrganizationsController < ApplicationController
    
    before_action :set_organization, only: [ :show, :edit, :update, :archive, :unarchive ]

    def index
      authorize Organization
      @organizations = Organization.unarchived.order(created_at: :desc)
    end

    def show
      authorize @organization
    end

    def edit
      authorize @organization
    end

    def create
      organization = Organization.new(organization_params)
      authorize organization

      if organization.save
        render json: organization, status: :created
      else
        render json: { errors: organization.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def update
      authorize @organization

      if @organization.update(organization_params)
        redirect_to admin_organization_path(@organization), notice: "Organization was successfully updated."
      else
        render :edit
      end
    end

    def archive
      authorize @organization, :archive?

      ActiveRecord::Base.transaction do
        if @organization.archive!
          redirect_to admin_organizations_path, notice: "Organization was successfully archived."
        else
          redirect_to admin_organizations_path, alert: "Failed to archive organization."
        end
      end
    end

    def unarchive
      authorize @organization, :unarchive?

      ActiveRecord::Base.transaction do
        if @organization.unarchive!
          redirect_to admin_organizations_path, notice: "Organization was successfully unarchived."
        else
          redirect_to admin_organizations_path, alert: "Failed to unarchive organization."
        end
      end
    end

    def archived
      authorize Organization, :index?
      @organizations = Organization.archived.order(archived_at: :desc)
    end

    private

    def set_organization
      @organization = Organization.find(params[:id])
    end

    def organization_params
      params.require(:organization).permit(:name, :description, :parent_id, :is_trial, :settings, :logo, :locale)
    end
  end
end
