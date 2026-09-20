# frozen_string_literal: true

require "rails_helper"

RSpec.describe DocumentTextExtractor do
  def build_attachment(filename:, content_type:, content:)
    organization = create(:organization)
    member = create(:member, organization: organization)
    chat = create(:ai_chat, organization: organization, member: member, kind: "chart_of_accounts")
    message = chat.append_message!(role: "user", content: "hi", sender_member: member)

    document = Document.new(
      organization: organization,
      documentable: message,
      member: member
    )
    document.attachment.attach(
      io: StringIO.new(content),
      filename: filename,
      content_type: content_type
    )
    document.save!
    document.attachment
  end

  def fixture_attachment(filename:, content_type:)
    path = Rails.root.join("spec", "fixtures", "files", filename)
    content = File.binread(path)

    build_attachment(filename: filename, content_type: content_type, content: content)
  end

  describe "text/plain" do
    it "extracts the raw text" do
      attachment = fixture_attachment(filename: "sample.txt", content_type: "text/plain")
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be true
      expect(result.kind).to eq(:text)
      expect(result.text).to include("Hello from a plain text file")
    end
  end

  describe "text/csv" do
    it "converts CSV to tab-separated text" do
      attachment = fixture_attachment(filename: "sample.csv", content_type: "text/csv")
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be true
      expect(result.kind).to eq(:csv)
      expect(result.text).to include("code\tname\tbalance")
      expect(result.text).to include("1000\tCash\t5000.00")
    end
  end

  describe "application/json" do
    it "pretty-prints the JSON" do
      attachment = fixture_attachment(filename: "sample.json", content_type: "application/json")
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be true
      expect(result.kind).to eq(:json)
      expect(result.text).to include("\"chart_name\": \"Sample\"")
    end
  end

  describe "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" do
    it "extracts the cells as tab-separated rows" do
      attachment = fixture_attachment(
        filename: "sample.xlsx",
        content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be true
      expect(result.kind).to eq(:xlsx)
      expect(result.text).to include("1000\tCash\t5000")
    end
  end

  describe "application/pdf with a text layer" do
    it "extracts the page text" do
      attachment = fixture_attachment(filename: "sample_text.pdf", content_type: "application/pdf")
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be true
      expect(result.kind).to eq(:pdf)
      expect(result.text).to include("Hello from a PDF file")
    end
  end

  describe "application/pdf that is scanned (no text layer)" do
    it "returns a friendly error and marks the kind as pdf_scanned" do
      attachment = fixture_attachment(filename: "sample_scanned.pdf", content_type: "application/pdf")
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be false
      expect(result.kind).to eq(:pdf_scanned)
      expect(result.error).to include("scanned image")
      expect(result.text).to eq("")
    end
  end

  describe "unsupported file type" do
    it "returns an unsupported error" do
      # Document's own whitelist would reject this, so we bypass validation
      # here. This spec exercises DocumentTextExtractor's defensive branch:
      # what happens if a Document with an unknown type somehow reaches the
      # extractor. That shouldn't happen in production, but if a MIME type
      # is ever misclassified, the extractor fails gracefully rather than
      # raising.
      organization = create(:organization)
      member = create(:member, organization: organization)
      chat = create(:ai_chat, organization: organization, member: member, kind: "chart_of_accounts")
      message = chat.append_message!(role: "user", content: "hi", sender_member: member)

      document = Document.new(
        organization: organization,
        documentable: message,
        member: member
      )
      document.attachment.attach(
        io: StringIO.new("binary content"),
        filename: "weird.xyz",
        content_type: "application/octet-stream"
      )
      document.save!(validate: false)

      result = described_class.call(attachment: document.attachment)

      expect(result.success?).to be false
      expect(result.kind).to eq(:unsupported)
    end
  end

  describe "when no attachment is present" do
    it "returns an unsupported error" do
      attachment = ActiveStorage::Attachment.new
      result = described_class.call(attachment: attachment)

      expect(result.success?).to be false
      expect(result.kind).to eq(:unsupported)
    end
  end
end
