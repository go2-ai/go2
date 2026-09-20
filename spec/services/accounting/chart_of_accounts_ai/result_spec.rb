# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::Result do
  describe ".new" do
    it "accepts a known status" do
      result = described_class.new(status: :awaiting_input)
      expect(result.status).to eq(:awaiting_input)
    end

    it "raises on an unknown status" do
      expect {
        described_class.new(status: :nonsense)
      }.to raise_error(ArgumentError, /Unknown status/)
    end

    it "defaults messages_created to an empty array" do
      expect(described_class.new(status: :awaiting_input).messages_created).to eq([])
    end

    it "defaults errors to an empty array" do
      expect(described_class.new(status: :awaiting_input).errors).to eq([])
    end
  end

  describe "predicates" do
    it "#proposal_ready?" do
      expect(described_class.new(status: :proposal_ready).proposal_ready?).to be true
      expect(described_class.new(status: :awaiting_input).proposal_ready?).to be false
    end

    it "#awaiting_input?" do
      expect(described_class.new(status: :awaiting_input).awaiting_input?).to be true
    end

    it "#retries_exhausted?" do
      expect(described_class.new(status: :retries_exhausted).retries_exhausted?).to be true
    end

    it "#not_configured?" do
      expect(described_class.new(status: :not_configured).not_configured?).to be true
    end

    it "#provider_error?" do
      expect(described_class.new(status: :provider_error).provider_error?).to be true
    end
  end

  describe "status constants" do
    it "exposes every status through STATUSES" do
      expect(described_class::STATUSES).to contain_exactly(
        :awaiting_input, :proposal_ready, :retries_exhausted,
        :not_configured, :provider_error
      )
    end
  end
end
