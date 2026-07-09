class G2::UsageRecord < ApplicationRecord
  self.table_name = "usage_records"

  belongs_to :organization

  validates :module, inclusion: { in: G2::Modules::ALL }
  validates :key, presence: true

  # Atomically increments today's (or a given day's) usage count for an
  # org+module+key. Safe under concurrency - a single INSERT ... ON CONFLICT
  # statement, not a read-then-write race.
  def self.record!(organization:, module_key:, key:, quantity: 1, on: Date.current)
    sql = sanitize_sql_array([
      <<~SQL,
        INSERT INTO usage_records (organization_id, module, key, period, quantity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, now(), now())
        ON CONFLICT (organization_id, module, key, period)
        DO UPDATE SET quantity = usage_records.quantity + EXCLUDED.quantity, updated_at = now()
      SQL
      organization.id, module_key, key, on, quantity
    ])
    connection.execute(sql)
  end

  # Total usage for a module+key, across an organization AND all of its
  # descendant organizations, within a date range - this is what invoicing
  # uses to compute overage.
  def self.total_for(organization, module_key:, key:, from:, to:)
    org_ids = organization.self_and_descendant_ids
    where(organization_id: org_ids, module: module_key, key: key, period: from.to_date..to.to_date)
      .sum(:quantity)
  end
end