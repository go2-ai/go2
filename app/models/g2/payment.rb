class G2::Payment < ApplicationRecord
  self.table_name = "payments"

  belongs_to :invoice, class_name: "G2::Invoice"
  has_many :payment_events, class_name: "G2::PaymentEvent", foreign_key: :payment_id, dependent: :destroy

  enum :payment_status, {
    waiting: "waiting",
    confirming: "confirming",
    confirmed: "confirmed",
    sending: "sending",
    finished: "finished",
    partially_paid: "partially_paid",
    failed: "failed",
    refunded: "refunded",
    expired: "expired"
  }, default: "waiting"

  FAILED_STATUSES = %w[failed refunded expired].freeze

  def successful?
    confirmed? || finished?
  end

  def unsuccessful?
    FAILED_STATUSES.include?(payment_status)
  end

  # Records the raw IPN (append-only audit trail), updates this payment's
  # status, and - the first time it succeeds - marks the invoice paid,
  # which cascades to activating any pending subscription.
  def update_from_ipn!(payload)
    payment_events.create!(
      event_type: payload["payment_status"],
      payload: payload,
      received_at: Time.current
    )

    update!(
      payment_status: payload["payment_status"],
      provider_response: provider_response.merge(payload)
    )

    if successful? && paid_at.nil?
      update!(paid_at: Time.current)
      invoice.mark_paid!
    end
  end
end