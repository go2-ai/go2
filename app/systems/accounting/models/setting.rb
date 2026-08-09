module Accounting
  class Setting < ApplicationRecord
    self.table_name = "accounting_settings"

    belongs_to :organization
    belongs_to :main_currency, class_name: "Currency", optional: true

    validates :organization_id, uniqueness: true
  end
end