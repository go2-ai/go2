require "rails_helper"

RSpec.describe G2::Invoice, type: :model do
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }

  before do
    G2::Price.replace!("accounting", "level_1", "monthly", 3000) # $30/mo - easy proration math
  end

  describe ".create_for_organization!" do
    it "generates sequential, org-scoped invoice numbers" do
      invoice1 = described_class.create_for_organization!(organization)
      invoice2 = described_class.create_for_organization!(organization)

      expect(invoice1.invoice_number).to eq("#{organization.id}/1")
      expect(invoice2.invoice_number).to eq("#{organization.id}/2")
    end

    it "sets a default due date" do
      invoice = described_class.create_for_organization!(organization)
      expect(invoice.due_at).to be_within(1.minute).of(Time.current + described_class::DEFAULT_PAYMENT_TERM_DAYS.days)
    end
  end

  describe ".create_for_subscription!" do
    it "charges the full price for a full, unshortened period" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      invoice = described_class.create_for_subscription!(sub)

      expect(invoice.invoice_items.first.amount_cents).to eq(3000)
      expect(invoice.total_cents).to eq(3000)
    end

    it "prorates the price when the period was shortened to sync a billing anchor" do
      sub1 = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub1.update!(status: "active")

      # Shorten sub1's own end date to simulate "15 days left in the cycle"
      sub1.update!(ends_at: 15.days.from_now)

      G2::Price.replace!("general", "level_1", "monthly", 3000)
      sub2 = G2::Subscription.subscribe!(organization: organization, module_key: "general", plan: "level_1", billing_period: "monthly")
      invoice = described_class.create_for_subscription!(sub2)

      # ~15 days out of a ~30 day month => roughly half price, not the full $30
      expect(invoice.invoice_items.first.amount_cents).to be < 3000
      expect(invoice.invoice_items.first.amount_cents).to be_within(300).of(1500)
    end
  end

  describe ".create_for_renewal!" do
    it "charges full price for the next period, without touching the subscription yet" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid! # activate it first

      original_ends_at = sub.reload.ends_at
      invoice = described_class.create_for_renewal!(sub)

      expect(invoice.invoice_items.first.amount_cents).to eq(3000)
      expect(sub.reload.ends_at).to eq(original_ends_at) # NOT extended yet - only on payment
    end

    it "extends the subscription only once the renewal invoice is paid" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      original_ends_at = sub.reload.ends_at

      renewal_invoice = described_class.create_for_renewal!(sub)
      renewal_invoice.mark_paid!

      expect(sub.reload.ends_at).to be > original_ends_at
      expect(sub.active?).to eq(true)
    end
  end

  describe "overage billing on renewal" do
    before do
      G2::PlanLimit.create!(module: "accounting", plan: "level_1", key: "journal_entries", value: 50, overage_price_cents: 20)
    end

    it "adds an overage line item when usage exceeds the plan's included quantity" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!

      G2::UsageRecord.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 70, on: sub.starts_at.to_date)

      renewal_invoice = described_class.create_for_renewal!(sub)
      overage_item = renewal_invoice.invoice_items.find_by(unit_price_cents: 20)

      expect(overage_item.quantity).to eq(20) # 70 used - 50 included = 20 over
      expect(overage_item.amount_cents).to eq(400) # 20 * $0.20
      expect(renewal_invoice.total_cents).to eq(3000 + 400) # base + overage
    end

    it "adds no overage item when usage stays within the included quantity" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!

      G2::UsageRecord.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 30, on: sub.starts_at.to_date)

      renewal_invoice = described_class.create_for_renewal!(sub)

      expect(renewal_invoice.invoice_items.count).to eq(1) # base charge only
      expect(renewal_invoice.total_cents).to eq(3000)
    end

    it "rolls up usage from descendant organizations into the overage calculation" do
      child = create(:organization, is_tenant: false, parent_id: organization.id)
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!

      G2::UsageRecord.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 40, on: sub.starts_at.to_date)
      G2::UsageRecord.record!(organization: child, module_key: "accounting", key: "journal_entries", quantity: 20, on: sub.starts_at.to_date)

      renewal_invoice = described_class.create_for_renewal!(sub)
      overage_item = renewal_invoice.invoice_items.find_by(unit_price_cents: 20)

      expect(overage_item.quantity).to eq(10) # (40+20) - 50 included = 10 over
    end
  end

  describe "#mark_paid!" do
    it "activates the pending subscription tied to this invoice" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      invoice = described_class.create_for_subscription!(sub)

      invoice.mark_paid!

      expect(invoice.reload.status).to eq("paid")
      expect(invoice.paid_at).to be_present
      expect(sub.reload.status).to eq("active")
    end

    it "extends the subscription only ONCE even with both a base and an overage item (regression check)" do
      G2::PlanLimit.create!(module: "accounting", plan: "level_1", key: "journal_entries", value: 50, overage_price_cents: 20)

      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      G2::UsageRecord.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 70, on: sub.starts_at.to_date)

      pre_renewal_ends_at = sub.reload.ends_at
      renewal_invoice = described_class.create_for_renewal!(sub)
      expect(renewal_invoice.invoice_items.count).to eq(2) # confirms both items exist

      renewal_invoice.mark_paid!

      # Exactly one month added, not two - proves renew! only ran once
      expect(sub.reload.ends_at).to be_within(1.minute).of(pre_renewal_ends_at + 1.month)
    end

    it "is idempotent - calling it twice doesn't error or double-process" do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      invoice = described_class.create_for_subscription!(sub)

      invoice.mark_paid!
      first_paid_at = invoice.reload.paid_at

      expect { invoice.mark_paid! }.not_to raise_error
      expect(invoice.reload.paid_at).to eq(first_paid_at)
    end
  end
end