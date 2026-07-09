# frozen_string_literal: true

Rails.application.config.x.now_payments = ActiveSupport::OrderedOptions.new

if Rails.env.test?
  Rails.application.config.x.now_payments.api_key           = "test_api_key"
  Rails.application.config.x.now_payments.ipn_secret        = "test_ipn_secret"
  Rails.application.config.x.now_payments.base_url          = "https://api-sandbox.nowpayments.io"
  Rails.application.config.x.now_payments.ipn_callback_url  = "https://example.com/webhooks/now_payments"
  Rails.application.config.x.now_payments.sandbox           = true
elsif Rails.env.production?
  # Production uses live API unless SANDBOX is explicitly set
  sandbox = ActiveModel::Type::Boolean.new.cast(ENV["NOWPAYMENTS_SANDBOX"])

  Rails.application.config.x.now_payments.api_key  = ENV.fetch("NOWPAYMENTS_API_KEY")
  Rails.application.config.x.now_payments.ipn_secret = ENV.fetch("NOWPAYMENTS_IPN_SECRET")
  Rails.application.config.x.now_payments.sandbox   = sandbox

  Rails.application.config.x.now_payments.base_url = if sandbox
    "https://api-sandbox.nowpayments.io"
  else
    "https://api.nowpayments.io"
  end

  # MUST be set per-environment — NOWPayments sends IPNs here
  Rails.application.config.x.now_payments.ipn_callback_url = ENV.fetch("NOWPAYMENTS_IPN_CALLBACK_URL")
else
  # Development — defaults to sandbox
  sandbox = ActiveModel::Type::Boolean.new.cast(ENV.fetch("NOWPAYMENTS_SANDBOX", "true"))

  Rails.application.config.x.now_payments.api_key  = if sandbox
    ENV.fetch("NOWPAYMENTS_SANDBOX_API_KEY", "sandbox_default")
  else
    ENV.fetch("NOWPAYMENTS_API_KEY", "live_default")
  end

  Rails.application.config.x.now_payments.ipn_secret = if sandbox
    ENV.fetch("NOWPAYMENTS_SANDBOX_IPN_SECRET", "sandbox_ipn_default")
  else
    ENV.fetch("NOWPAYMENTS_IPN_SECRET", "live_ipn_default")
  end

  Rails.application.config.x.now_payments.sandbox = sandbox

  Rails.application.config.x.now_payments.base_url = if sandbox
    "https://api-sandbox.nowpayments.io"
  else
    "https://api.nowpayments.io"
  end

  # For local dev, NOWPayments can't reach localhost — use a tunnel (ngrok) or
  # leave it unset if you're not testing IPNs locally.
  Rails.application.config.x.now_payments.ipn_callback_url =
    ENV.fetch("NOWPAYMENTS_IPN_CALLBACK_URL", "http://localhost:3000/webhooks/now_payments")
end