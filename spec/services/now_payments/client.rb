require "rails_helper"

RSpec.describe NowPayments::Client do
  describe ".verify_ipn!" do
    let(:secret) { "test_ipn_secret" }
    let(:payload) { { "payment_id" => "123", "payment_status" => "confirmed", "order_id" => "1" } }
    let(:raw_body) { payload.to_json }

    before do
      allow(Rails.application.config.x.now_payments).to receive(:ipn_secret).and_return(secret)
    end

    def valid_signature_for(payload_hash)
      sorted = described_class.sort_keys(payload_hash).to_json
      OpenSSL::HMAC.hexdigest("SHA512", secret, sorted)
    end

    it "returns the parsed payload when the signature is valid" do
      signature = valid_signature_for(payload)
      result = described_class.verify_ipn!(raw_body, signature)
      expect(result).to eq(payload)
    end

    it "raises when the signature doesn't match" do
      expect {
        described_class.verify_ipn!(raw_body, "wrong_signature")
      }.to raise_error(NowPayments::Client::Error, /Invalid IPN signature/)
    end

    it "raises when no signature header is given" do
      expect {
        described_class.verify_ipn!(raw_body, nil)
      }.to raise_error(NowPayments::Client::Error)
    end

    it "is order-independent - key order in the JSON doesn't affect the signature" do
      reordered_body = { "order_id" => "1", "payment_status" => "confirmed", "payment_id" => "123" }.to_json
      signature = valid_signature_for(payload)
      expect { described_class.verify_ipn!(reordered_body, signature) }.not_to raise_error
    end
  end
end