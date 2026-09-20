# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Adapters::Openrouter do
  subject(:adapter) do
    described_class.new(
      api_key: "sk-or-test-key",
      model: "test/model",
      open_timeout: 5,
      read_timeout: 60
    )
  end

  let(:endpoint) { "https://openrouter.ai/api/v1/chat/completions" }

  # ── Initialization ──────────────────────────────────────────────────────

  describe "#initialize" do
    it "raises Ai::ConfigurationError when api_key is blank" do
      expect {
        described_class.new(api_key: "")
      }.to raise_error(Ai::ConfigurationError, /AI_API_KEY/)
    end

    it "raises when api_key is nil" do
      expect {
        described_class.new(api_key: nil)
      }.to raise_error(Ai::ConfigurationError)
    end

    it "accepts a valid api_key" do
      expect { described_class.new(api_key: "k") }.not_to raise_error
    end
  end

  describe "#available?" do
    it "is true when configured" do
      expect(adapter.available?).to be true
    end
  end

  # ── Happy path ──────────────────────────────────────────────────────────

  describe "#complete" do
    let(:success_body) do
      {
        id: "gen-123",
        model: "test/model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello back!" },
            finish_reason: "stop"
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      }
    end

    it "posts to the OpenRouter endpoint and parses a plain text response" do
      stub = stub_request(:post, endpoint)
        .with(
          headers: {
            "Authorization" => "Bearer sk-or-test-key",
            "Content-Type"  => "application/json"
          }
        )
        .to_return(
          status: 200,
          body: success_body.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      response = adapter.complete(messages: [ { role: "user", content: "hi" } ])

      expect(stub).to have_been_requested.once
      expect(response).to be_a(Ai::Response)
      expect(response.content).to eq("Hello back!")
      expect(response.tool_calls).to eq([])
      expect(response.usage).to eq({ "prompt_tokens" => 5, "completion_tokens" => 3, "total_tokens" => 8 })
    end

    it "sends the system prompt as the first message" do
      captured = nil
      stub_request(:post, endpoint).to_return do |request|
        captured = JSON.parse(request.body)
        { status: 200, body: success_body.to_json, headers: { "Content-Type" => "application/json" } }
      end

      adapter.complete(
        messages: [ { role: "user", content: "hi" } ],
        system: "You are helpful."
      )

      expect(captured["messages"].first).to eq({ "role" => "system", "content" => "You are helpful." })
      expect(captured["messages"].last).to eq({ "role" => "user", "content" => "hi" })
    end

    it "sends the model from the initializer when no model override is passed" do
      captured = nil
      stub_request(:post, endpoint).to_return do |request|
        captured = JSON.parse(request.body)
        { status: 200, body: success_body.to_json, headers: { "Content-Type" => "application/json" } }
      end

      adapter.complete(messages: [ { role: "user", content: "hi" } ])
      expect(captured["model"]).to eq("test/model")
    end

    it "overrides the model when a model kwarg is passed" do
      captured = nil
      stub_request(:post, endpoint).to_return do |request|
        captured = JSON.parse(request.body)
        { status: 200, body: success_body.to_json, headers: { "Content-Type" => "application/json" } }
      end

      adapter.complete(messages: [ { role: "user", content: "hi" } ], model: "other/model")
      expect(captured["model"]).to eq("other/model")
    end

    it "sends tools and tool_choice when tools are provided" do
      captured = nil
      stub_request(:post, endpoint).to_return do |request|
        captured = JSON.parse(request.body)
        { status: 200, body: success_body.to_json, headers: { "Content-Type" => "application/json" } }
      end

      tools = [ { type: "function", function: { name: "propose_chart_of_accounts" } } ]
      adapter.complete(messages: [ { role: "user", content: "hi" } ], tools: tools)

      expect(captured["tools"]).to eq([ { "type" => "function", "function" => { "name" => "propose_chart_of_accounts" } } ])
      expect(captured["tool_choice"]).to eq("auto")
    end

    it "omits tools entirely when no tools are provided" do
      captured = nil
      stub_request(:post, endpoint).to_return do |request|
        captured = JSON.parse(request.body)
        { status: 200, body: success_body.to_json, headers: { "Content-Type" => "application/json" } }
      end

      adapter.complete(messages: [ { role: "user", content: "hi" } ])
      expect(captured).not_to have_key("tools")
      expect(captured).not_to have_key("tool_choice")
    end
  end

  # ── Tool calls ──────────────────────────────────────────────────────────

  describe "#complete with tool calls" do
    it "parses tool calls with JSON-encoded arguments into a Hash" do
      body = {
        choices: [
          {
            message: {
              role: "assistant",
              content: nil,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "propose_chart_of_accounts",
                    arguments: '{"catalog_key":"service_company","ledgers":[]}'
                  }
                }
              ]
            }
          }
        ]
      }

      stub_request(:post, endpoint).to_return(
        status: 200,
        body: body.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      response = adapter.complete(messages: [ { role: "user", content: "hi" } ])

      expect(response.content).to eq("")
      expect(response.tool_calls?).to be true
      tc = response.first_tool_call
      expect(tc[:id]).to eq("call_1")
      expect(tc[:name]).to eq("propose_chart_of_accounts")
      expect(tc[:arguments]).to eq({ "catalog_key" => "service_company", "ledgers" => [] })
    end

    it "returns an empty arguments hash when the arguments string is malformed" do
      body = {
        choices: [
          {
            message: {
              role: "assistant",
              content: nil,
              tool_calls: [
                { id: "call_1", type: "function", function: { name: "x", arguments: "not-json" } }
              ]
            }
          }
        ]
      }

      stub_request(:post, endpoint).to_return(
        status: 200,
        body: body.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      response = adapter.complete(messages: [])
      expect(response.first_tool_call[:arguments]).to eq({})
    end
  end

  # ── Error handling ──────────────────────────────────────────────────────

  describe "#complete error handling" do
    it "raises AuthenticationError on 401" do
      stub_request(:post, endpoint).to_return(
        status: 401,
        body: { error: { message: "Invalid API key" } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::AuthenticationError, /Invalid API key/)
    end

    it "raises AuthenticationError on 403" do
      stub_request(:post, endpoint).to_return(status: 403, body: "")
      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::AuthenticationError)
    end

    it "raises RateLimitError on 429" do
      stub_request(:post, endpoint).to_return(
        status: 429,
        body: { error: { message: "Rate limited" } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::RateLimitError, /Rate limited/)
    end

    it "raises ClientError on 400" do
      stub_request(:post, endpoint).to_return(
        status: 400,
        body: { error: { message: "Bad model" } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::ClientError, /Bad model/)
    end

    it "raises ServerError on 500" do
      stub_request(:post, endpoint).to_return(
        status: 500,
        body: { error: { message: "Internal" } }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::ServerError, /Internal/)
    end

    it "raises ResponseParseError on a non-JSON body" do
      stub_request(:post, endpoint).to_return(
        status: 200,
        body: "<html>not json</html>",
        headers: { "Content-Type" => "text/html" }
      )

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::ResponseParseError, /non-JSON/)
    end

    it "raises NetworkError on a connection failure" do
      stub_request(:post, endpoint).to_raise(SocketError.new("getaddrinfo failed"))

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::NetworkError, /network error/)
    end

    it "raises NetworkError on a read timeout" do
      stub_request(:post, endpoint).to_raise(Net::ReadTimeout.new("timed out"))

      expect {
        adapter.complete(messages: [])
      }.to raise_error(Ai::NetworkError, /timed out/)
    end
  end
end
