class OrganizationsController < ApplicationController
  before_action :set_organization, only: [ :show, :update, :destroy ]
  skip_before_action :verify_authenticity_token

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
      else
        render json: { errors: @organization.errors.full_messages }, status: :unprocessable_content
      end
    else

    end
  end

  def update
    authorize @organization, :administrate?

    if @organization.update(permitted_params)
      render json: @organization, status: :ok
    else
      render json: { errors: @organization.errors.full_messages }, status: :unprocessable_content
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
    render json: { errors: [ "not_found" ] }, status: :not_found
  end

  def permitted_params
    params.permit(:locale, *t_params(:name), active_locales: [], calendar_types: [])
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

      Permission.create(
        code: Permission::ORG_ADMIN,
        grantee: member,
        organization: @organization
      )

      Permission.create(
        code: Permission::ACCOUNTING_MANAGE_SETTINGS,
        grantee: member,
        organization: @organization
      )
    end
  end
end
