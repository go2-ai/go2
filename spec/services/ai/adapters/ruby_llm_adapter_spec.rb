# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Adapters::RubyLlmAdapter do
  let(:endpoint) { "https://openrouter.ai/api/v1/chat/completions" }
  let(:adapter) { Ai::Adapters::Openrouter.new(api_key: "k", model: "test/model") }

  let(:final_tool) do
    { type: "function", function: { name: "propose", description: "Final answer",
                                    parameters: { type: "object", properties: { value: { type: "string" } } } } }
  end

  let(:lookup_tool_class) do
    Class.new(RubyLLM::Tool) do
      description "Looks a ledger up"
      parameter :code, description: "Ledger code"

      def self.name = "LedgerLookup"

      def execute(code:)
        { code: code, name: "Receivables" }
      end
    end
  end

  def tool_call_body(name, arguments, id: "call_1")
    {
      model: "test/model",
      choices: [ { message: { role: "assistant", content: nil,
                              tool_calls: [ { id: id, type: "function",
                                              function: { name: name, arguments: arguments.to_json } } ] } } ]
    }
  end

  it "runs lookup tools, sends their results back, and returns the final tool call" do
    bodies = []
    responses = [
      tool_call_body("ledger_lookup", { code: "11" }),
      tool_call_body("propose", { value: "done" }, id: "call_2")
    ]
    stub_request(:post, endpoint).to_return do |request|
      bodies << JSON.parse(request.body)
      { status: 200, body: responses.shift.to_json, headers: { "Content-Type" => "application/json" } }
    end

    response = adapter.complete(messages: [ { role: "user", content: "map" } ], tools: [ final_tool ],
                                lookup_tools: [ lookup_tool_class.new ])

    expect(bodies.size).to eq(2)
    expect(bodies.first["tools"].map { |t| t.dig("function", "name") }).to contain_exactly("propose", "ledger_lookup")
    tool_result = bodies.last["messages"].find { |m| m["role"] == "tool" }
    expect(tool_result["content"]).to include("Receivables")
    expect(response.first_tool_call).to include(name: "propose", arguments: { "value" => "done" })
  end

  it "never executes final tools" do
    stub_request(:post, endpoint).to_return(status: 200, body: tool_call_body("propose", { value: "x" }).to_json,
                                            headers: { "Content-Type" => "application/json" })

    response = adapter.complete(messages: [ { role: "user", content: "map" } ], tools: [ final_tool ])

    expect(a_request(:post, endpoint)).to have_been_made.once
    expect(response.first_tool_call[:name]).to eq("propose")
  end

  it "uses the NaraRouter base URL for the Nararouter adapter" do
    stub = stub_request(:post, "https://router.bynara.id/v1/chat/completions")
           .to_return(status: 200, body: { choices: [ { message: { role: "assistant", content: "hi" } } ] }.to_json,
                      headers: { "Content-Type" => "application/json" })

    response = Ai::Adapters::Nararouter.new(api_key: "k").complete(messages: [ { role: "user", content: "hi" } ])

    expect(stub).to have_been_requested
    expect(response.content).to eq("hi")
    expect(response.provider).to eq("nararouter")
  end
end
