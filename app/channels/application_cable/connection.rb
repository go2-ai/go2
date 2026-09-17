# frozen_string_literal: true

module ApplicationCable
  # Action Cable connection. Authenticates the WebSocket upgrade request
  # using the same Devise session cookie that HTTP requests use, read
  # from `env["warden"]` — Warden has already run on the upgrade request
  # by the time we get here, so `env["warden"].user` is the signed-in
  # User (or nil).
  #
  # This works because the frontend and backend are on the same origin,
  # so the browser sends session cookies with the WebSocket upgrade.
  # If you ever move to a token-in-header auth scheme, this is the place
  # that has to change (browsers don't send custom headers on WS
  # upgrades).
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
      reject_unauthorized_connection unless current_user
    end

    private

    def find_verified_user
      env["warden"]&.user
    end
  end
end