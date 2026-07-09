class G2::InvoiceItem < ApplicationRecord
  self.table_name = "invoice_items"

  belongs_to :invoice, class_name: "G2::Invoice"
  belongs_to :subscription, class_name: "G2::Subscription", optional: true

  validates :module, inclusion: { in: G2::Modules::ALL }
  validates :plan, inclusion: { in: G2::Plans::ALL }
  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
  validates :unit_price_cents, :amount_cents,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def unit_price
    unit_price_cents / 100.0
  end

  def amount
    amount_cents / 100.0
  end
end