class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  protect_from_forgery with: :exception

  include Pundit::Authorization

  rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized
  before_action :set_paper_trail_whodunnit
  helper_method :current_locale

  around_action :switch_locale

  def authorize(record, query = nil)
    return true if current_user&.is_go3_admin?

    super(record, query)
  end

  protected

  def configure_permitted_parameters
    # Sign up params
    devise_parameter_sanitizer.permit(:sign_up, keys: [
      :first_name, :last_name, :email, :password, :password_confirmation
    ])

    # Account update params
    devise_parameter_sanitizer.permit(:account_update, keys: [
      :first_name, :last_name, :email, :password, :password_confirmation,
      :current_password, :job_title, :avatar, :timezone, :preferred_locale
    ])

    # Sign in params
    devise_parameter_sanitizer.permit(:sign_in, keys: [
      :email, :password, :otp_code_attempt, :backup_code
    ])
  end

  # Redirect after sign in
  def after_sign_in_path_for(resource)
    # If user has 2FA enabled but not yet verified for this session
    if resource.otp_required_for_login? && !session[:otp_verified]
      users_two_factor_verification_path
    else
      # Track sign in activity
      resource.track_activity("sign_in")

      # Log security event
      resource.log_security_event("sign_in_success", {
        ip_address: request.ip,
        user_agent: request.user_agent
      })

      # Return to stored location or default
      stored_location_for(resource) || root_path
    end
  end

  private

  def user_not_authorized
    respond_to do |format|
      format.html do
        flash[:danger] = "You are not authorized to perform this action!"
        redirect_to(request.referrer || root_path)
      end
      format.any(:xml, :json) do
        render request.format.to_sym => { errors: [ "You are not authorized to perform this action!" ] },
               :status               => :forbidden
      end
      format.pdf do
        flash[:danger] = "You are not authorized to perform this action!"
        redirect_to(request.referrer || root_path)
      end
    end
  end

  def set_current_attributes
    Current.ip_address = request.ip
    Current.user_agent = request.user_agent
    Current.request_id = request.uuid
    Current.user = current_user
  end

  def set_locale
    # Get locale from user preference, params, or default
    locale = if user_signed_in?
               current_user.locale
    elsif params[:locale]
               params[:locale]
    else
               I18n.default_locale
    end

    # Ensure the locale is valid
    locale = I18n.default_locale unless I18n.available_locales.include?(locale.to_sym)

    # Set the locale for this request
    I18n.locale = locale.to_sym

    # Store the locale in the session for future requests
    session[:locale] = locale
  end

  def translate_flash_messages
    flash.each do |type, message|
      if message.is_a?(String)
        # Try to translate the message if it's a string
        flash[type] = I18n.t(message, default: message)
      elsif message.is_a?(Hash)
        # Handle nested flash messages (like in Devise)
        message.each do |key, value|
          if value.is_a?(String)
            message[key] = I18n.t(value, default: value)
          end
        end
      end
    end
  end

  def storable_location?
    request.get? && is_navigational_format? && !devise_controller? && !request.xhr?
  end

  def store_user_location!
    store_location_for(:user, request.fullpath)
  end

  def turbo_frame_request?
    request.headers["Turbo-Frame"].present?
  end

  def check_onboarding
    if user_signed_in? &&
       current_user.confirmed? &&
       !current_user.organizations.exists? &&
       !onboarding_controller? &&
       !(controller_name == "organizations" && action_name == "create")
      redirect_to new_onboarding_path
    end
  end

  def onboarding_controller?
    controller_name == "onboarding"
  end

  def handle_organization_redirect
    return unless user_signed_in?
    return if devise_controller?
    return if controller_name == "onboarding"
    return if controller_name == "organizations" && action_name == "create"
    return if request.xhr? || request.format.json?

    # Get user's organizations
    organizations = current_user.organizations.unarchived

    if organizations.empty?
      redirect_to new_onboarding_path unless onboarding_controller?
    elsif organizations.count == 1
      # If user has only one organization, redirect to it
      # redirect_to organization_path(organizations.first) unless current_page?(organization_path(organizations.first))
    else
      # If user has multiple organizations
      saved_org_id = session[:selected_organization_id]

      if saved_org_id && organizations.exists?(saved_org_id)
        # Use saved organization if it exists and is valid
        redirect_to organization_path(saved_org_id) unless current_page?(organization_path(saved_org_id))
      else
        # Otherwise use first organization
        redirect_to organization_path(organizations.first) unless current_page?(organization_path(organizations.first))
      end
    end
  end

  def current_page?(path)
    request.path == path
  end

  def current_organization
    Organization.find(params[:organization_id])
  end

  def current_member
    current_organization.members.find_by(user: current_user)
  end

  def current_locale
    current_user&.locale || I18n.default_locale
  end

  def t_params(attribute)
    current_organization.available_locales.map { |locale| "#{attribute}_#{locale}".to_sym }
  end

  def switch_locale(&action)
    locale = current_user&.locale || I18n.default_locale
    I18n.with_locale(locale, &action)
  end
end
