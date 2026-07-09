require "rails_helper"

RSpec.describe G2::Payment, type: :model do
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }
  let(:subscription) do
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
    G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
  end
  let(:invoice) { G2::Invoice.create_for_subscription!(subscription) }
  let(:payment) { invoice.payments.create!(provider: "nowpayments", amount_cents: invoice.total_cents) }

  describe "#update_from_ipn!" do
    it "logs every IPN received, even duplicates" do
      payment.update_from_ipn!({ "payment_status" => "waiting" })
      payment.update_from_ipn!({ "payment_status" => "confirming" })
      payment.update_from_ipn!({ "payment_status" => "confirming" }) # duplicate

      expect(payment.payment_events.count).to eq(3)
    end

    it "updates payment_status from the payload" do
      payment.update_from_ipn!({ "payment_status" => "confirming" })
      expect(payment.reload.payment_status).to eq("confirming")
    end

    it "cascades to mark the invoice paid on the first successful status" do
      payment.update_from_ipn!({ "payment_status" => "confirmed" })

      expect(invoice.reload.paid?).to eq(true)
      expect(subscription.reload.active?).to eq(true)
    end

    it "does not re-trigger the cascade on a second confirmed IPN (idempotent)" do
      payment.update_from_ipn!({ "payment_status" => "confirmed" })
      first_paid_at = payment.reload.paid_at

      payment.update_from_ipn!({ "payment_status" => "confirmed" })

      expect(payment.reload.paid_at).to eq(first_paid_at)
      expect(payment.payment_events.count).to eq(2) # still logged both times
    end

    it "treats finished the same as confirmed" do
      payment.update_from_ipn!({ "payment_status" => "finished" })
      expect(invoice.reload.paid?).to eq(true)
    end

    it "does not mark the invoice paid for a failed status" do
      payment.update_from_ipn!({ "payment_status" => "failed" })
      expect(invoice.reload.paid?).to eq(false)
      expect(payment.unsuccessful?).to eq(true)
    end
  end
end