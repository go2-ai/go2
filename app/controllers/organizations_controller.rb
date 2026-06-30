class OrganizationsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_organization, only: [ :show, :edit, :update, :destroy ]

  def index
    if params[:my_organizations]
      render json: current_user.organizations.as_json(only: [ :id, :name ]), status: :ok
    end
  end

  def show
    organization = Organization.find_by(id: params[:id])
    render json: { errors: [ "not_found" ] }, status: :not_found and return unless organization
    # Tech debt: Add translation
    authorize organization

    render json: OrganizationBlueprint.render(organization, view: params[:view] || :basic)
  end

  def new
    @organization = Organization.new(parent_id: params[:parent_id])
    authorize @organization
  end

  def edit
    authorize @organization
  end

  def create
    if params[:is_trial]
      name = params[:name] || Faker::Company.name
      Mobility.with_locale(current_user.locale) do
        @organization = Organization.new(name:, locale: current_user.locale, is_trial: true, is_tenant: false)
      end

      authorize @organization

      if @organization.save
        setCurrentUserAsAdmin
        render json: @organization.as_json(only: [ :id, :name ]), status: :ok
      end
    else

    end
  end

  def update
    authorize @organization

    if @organization.update(permitted_organization_params)
      redirect_to @organization, notice: "Organization was successfully updated."
    else
      render :edit
    end
  end

  def destroy
    authorize @organization

    ActiveRecord::Base.transaction do
      if @organization.is_trial? || current_user.has_role?("GO3_Admin")
        # Explicitly archive rather than destroy
        if @organization.archive
          redirect_to organizations_path, notice: "Organization was successfully archived."
        else
          redirect_to organizations_path, alert: "Failed to archive organization."
        end
      else
        redirect_to organizations_path, alert: "Only trial organizations can be archived by organization admins."
      end
    end
  end

  private

  def set_organization
    @organization = Organization.unarchived.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    # Attempt to find the record even if it's archived
    @organization = Organization.archived.find(params[:id])
    redirect_to organizations_path, alert: "The organization you are looking for has been archived." if @organization.archived?
  end

  def permitted_organization_params
    params.require(:organization).permit(*policy(@organization || Organization).permitted_attributes)
  end

  def setCurrentUserAsAdmin
    Mobility.with_locale(current_user.locale) do
      member = Member.create(
        user: current_user,
        name: current_user.full_name,
        organization: @organization,
        email: current_user.email,
        joined_at: DateTime.now,
        initial: current_user.first_name[0].upcase + current_user.last_name[0].upcase,
        color: "#c9b12d"
      )

      permission = Permission.create(
        code: Permission::ORG_ADMIN,
        grantee: member,
        organization: @organization
      )
    end
  end
end
