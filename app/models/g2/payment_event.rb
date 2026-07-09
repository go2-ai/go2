class G2::PaymentEvent < ApplicationRecord
  self.table_name = "payment_events"

  belongs_to :payment, class_name: "G2::Payment"

  # No updated_at column on this table on purpose - these rows are written
  # once and never modified, so there's nothing to track changes to.
end