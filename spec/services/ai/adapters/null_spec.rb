# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Adapters::Null do
  subject(:adapter) { described_class.new }

  describe "#complete" do
    it "returns an Ai::Response with the canned message" do
      response = adapter.complete(messages: [ { role: "user", content: "hi" } ])
      expect(response).to be_a(Ai::Response)
      expect(response.content).to include("not configured")
    end

    it "returns no tool calls" do
      response = adapter.complete(messages: [])
      expect(response.tool_calls).to eq([])
    end

    it "records the received message count and tool names in raw" do
      tools = [
        { type: "function", function: { name: "propose_chart_of_accounts" } }
      ]
      response = adapter.complete(messages: [ { role: "user", content: "hi" } ], tools: tools)

      expect(response.raw[:provider]).to eq("null")
      expect(response.raw[:received_messages]).to eq(1)
      expect(response.raw[:received_tools]).to eq([ "propose_chart_of_accounts" ])
    end
  end

  describe "#available?" do
    it "is false" do
      expect(adapter.available?).to be false
    end
  end

  describe "#name" do
    it "returns 'null'" do
      expect(adapter.name).to eq("null")
    end
  end
end
