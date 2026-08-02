class FixSubscriptionsUniqueIndexToIncludePending < ActiveRecord::Migration[8.0]
  def change
    remove_index :subscriptions, [:organization_id, :module], name: "index_subscriptions_on_org_and_module_when_active"
 
    # Now covers BOTH pending (unpaid, just created) and active (paid) -
    # an org can't have two "live" subscriptions to the same module,
    # whether or not either has actually been paid for yet.
    add_index :subscriptions, [:organization_id, :module],
              unique: true, where: "status IN ('pending', 'active')",
              name: "index_subscriptions_on_org_and_module_when_live"
  end
end
