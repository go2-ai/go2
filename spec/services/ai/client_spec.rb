# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Client do
  around do |example|
    original_provider = ENV["AI_PROVIDER"]
    original_key      = ENV["AI_API_KEY"]
    described_class.reset_adapter!
    example.run
  ensure
    ENV["AI_PROVIDER"] = original_provider
    ENV["AI_API_KEY"]  = original_key
    described_class.reset_adapter!
  end

  describe ".adapter" do
    context "when AI_PROVIDER is unset" do
      before do
        ENV.delete("AI_PROVIDER")
        described_class.reset_adapter!
      end

      it "falls back to the Null adapter" do
        expect(described_class.adapter).to be_a(Ai::Adapters::Null)
      end
    end

    context "when AI_PROVIDER is an unknown name" do
      before do
        ENV["AI_PROVIDER"] = "not_a_real_provider"
        described_class.reset_adapter!
      end

      it "falls back to the Null adapter" do
        expect(described_class.adapter).to be_a(Ai::Adapters::Null)
      end
    end

    context "when AI_PROVIDER=null" do
      before do
        ENV["AI_PROVIDER"] = "null"
        described_class.reset_adapter!
      end

      it "uses the Null adapter" do
        expect(described_class.adapter).to be_a(Ai::Adapters::Null)
      end
    end

    context "when AI_PROVIDER=openrouter with an API key" do
      before do
        ENV["AI_PROVIDER"] = "openrouter"
        ENV["AI_API_KEY"]  = "sk-or-test-key"
        described_class.reset_adapter!
      end

      it "uses the OpenRouter adapter" do
        expect(described_class.adapter).to be_a(Ai::Adapters::Openrouter)
      end
    end

    context "when AI_PROVIDER=openrouter but the API key is missing" do
      before do
        ENV["AI_PROVIDER"] = "openrouter"
        ENV.delete("AI_API_KEY")
        described_class.reset_adapter!
      end

      it "falls back to the Null adapter instead of raising" do
        expect(described_class.adapter).to be_a(Ai::Adapters::Null)
      end
    end
  end

  describe ".available?" do
    it "is false when using the Null adapter" do
      ENV.delete("AI_PROVIDER")
      described_class.reset_adapter!
      expect(described_class.available?).to be false
    end

    it "is true when using a real adapter" do
      ENV["AI_PROVIDER"] = "openrouter"
      ENV["AI_API_KEY"]  = "sk-or-test-key"
      described_class.reset_adapter!
      expect(described_class.available?).to be true
    end
  end

  describe ".complete" do
    before do
      ENV.delete("AI_PROVIDER")
      described_class.reset_adapter!
    end

    it "returns an Ai::Response via the Null adapter" do
      response = described_class.complete(messages: [ { role: "user", content: "hi" } ])
      expect(response).to be_a(Ai::Response)
      expect(response.content).to include("not configured")
      expect(response.tool_calls).to eq([])
    end
  end
end
