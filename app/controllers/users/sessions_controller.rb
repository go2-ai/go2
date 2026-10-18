# frozen_string_literal: true

class Users::SessionsController < Devise::SessionsController
  # before_action :configure_sign_in_params, only: [:create]
  skip_before_action :verify_authenticity_token

  # Devise discards the session CSRF token on sign in / sign out, so the token
  # in the SPA's <meta> tag becomes stale. Hand the SPA a fresh one.
  after_action :expose_csrf_token, only: %i[create destroy]

  # POST /resource/sign_in
  def create
    self.resource = warden.authenticate(auth_options)

    if resource && sign_in(resource_name, resource)
      render json: resource, only: %i[id email locale], status: :ok
    else
      render json: { errors: [ "authentication_failed" ] }, status: :unauthorized
    end
  end

  # DELETE /resource/sign_out
  def destroy
    if sign_out(resource_name)
      render json: { message: "Signed out" }, status: :ok
    else
      render json: { errors: [ "authentication_failed" ] }, status: :unauthorized
    end
  end

  private

  def expose_csrf_token
    response.set_header("X-CSRF-Token", form_authenticity_token)
  end
end
