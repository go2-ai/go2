# frozen_string_literal: true

require "pdf/reader"
require "csv"
require "json"

# Extracts plain text from an Active Storage attachment for downstream
# consumption (typically feeding an LLM).
#
# This is deliberately NOT namespaced under Ai:: or Accounting:: — it's a
# general-purpose utility, and other features (future document search,
# contract analysis, etc.) will want it too.
#
# Usage:
#
#   attachment = user_message.documents.first.attachment
#   result = DocumentTextExtractor.call(attachment: attachment)
#   result.text    # => "..."
#   result.kind    # => :pdf | :pdf_scanned | :xlsx | :csv | :json | :text | :unsupported
#   result.error   # => nil or a user-facing string
#
# The extractor NEVER raises on malformed input. It returns a Result with
# `error` set instead, so callers can decide how to surface the failure.
# Only a truly unexpected internal error (bug in our code) raises.
class DocumentTextExtractor
  Result = Struct.new(:text, :kind, :error, keyword_init: true) do
    def success?
      error.nil?
    end

    def failed?
      !success?
    end
  end

  # Message shown to the user when a PDF has no extractable text layer.
  # Designed to be safe to surface directly in the chat UI.
  SCANNED_PDF_MESSAGE = "This file looks like a scanned image — I can't read it yet."
  UNSUPPORTED_MESSAGE  = "I can't read this file type."

  class << self
    def call(attachment:)
      new(attachment: attachment).call
    end
  end

  def initialize(attachment:)
    @attachment = attachment
  end

  def call
    return failure(:unsupported, UNSUPPORTED_MESSAGE) unless attachment_present?

    content_type = attachment.content_type.to_s
    filename = attachment.filename.to_s

    case
    when content_type == "text/plain" || filename.end_with?(".txt")
      extract_text
    when content_type == "text/csv" || filename.end_with?(".csv")
      extract_csv
    when content_type == "application/json" || filename.end_with?(".json")
      extract_json
    when xlsx?(content_type, filename)
      extract_xlsx
    when content_type == "application/pdf" || filename.end_with?(".pdf")
      extract_pdf
    else
      failure(:unsupported, UNSUPPORTED_MESSAGE)
    end
  rescue => e
    Rails.logger.error(
      "[DocumentTextExtractor] #{attachment_label} failed: #{e.class}: #{e.message}"
    )
    failure(:unsupported, "I couldn't read this file.")
  end

  private

  attr_reader :attachment

  # ── Format-specific extractors ──────────────────────────────────────

  def extract_text
    text = attachment.download.force_encoding("UTF-8")
    Result.new(text: text.scrub, kind: :text, error: nil)
  end

  def extract_csv
    raw = attachment.download.force_encoding("UTF-8")
    rows = CSV.parse(raw)
    # Re-emit as tab-separated text so the LLM gets a clean tabular view.
    text = rows.map { |row| row.join("\t") }.join("\n")
    Result.new(text: text.scrub, kind: :csv, error: nil)
  rescue CSV::MalformedCSVError => e
    failure(:csv, "This CSV file appears to be malformed: #{e.message}")
  end

  def extract_json
    raw = attachment.download.force_encoding("UTF-8")
    parsed = JSON.parse(raw)
    Result.new(text: JSON.pretty_generate(parsed), kind: :json, error: nil)
  rescue JSON::ParserError
    failure(:json, "This JSON file appears to be malformed.")
  end

  def extract_xlsx
    require "xsv"
    rows = []
    Xsv.open(StringIO.new(attachment.download)) do |workbook|
      workbook.sheets.each do |sheet|
        rows << "### Sheet: #{sheet.name}"
        sheet.each_row do |row|
          rows << row.map(&:to_s).join("\t")
        end
      end
    end
    Result.new(text: rows.join("\n"), kind: :xlsx, error: nil)
  rescue => e
    Rails.logger.warn("[DocumentTextExtractor] XLSX parse failed: #{e.class}: #{e.message}")
    failure(:xlsx, "This spreadsheet couldn't be read.")
  end

  def extract_pdf
    text_chunks = []
    io = StringIO.new(attachment.download)
    reader = PDF::Reader.new(io)
    reader.pages.each { |page| text_chunks << page.text }
    text = text_chunks.join("\n\n").strip

    if text.empty?
      # No text layer — most likely a scanned image embedded in a PDF.
      failure(:pdf_scanned, SCANNED_PDF_MESSAGE)
    else
      Result.new(text: text.scrub, kind: :pdf, error: nil)
    end
  rescue PDF::Reader::MalformedPDFError, PDF::Reader::UnsupportedFeatureError => e
    Rails.logger.warn("[DocumentTextExtractor] PDF parse failed: #{e.class}: #{e.message}")
    failure(:pdf, "This PDF couldn't be read.")
  end

  # ── Helpers ─────────────────────────────────────────────────────────

  def xlsx?(content_type, filename)
    content_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      filename.end_with?(".xlsx")
  end

  def failure(kind, message)
    Result.new(text: "", kind: kind, error: message)
  end

  # True only if the attachment exists AND has a blob attached. A bare
  # ActiveStorage::Attachment.new has neither, and would raise on any
  # delegation to #blob or #filename.
  def attachment_present?
    attachment.present? && attachment.blob.present?
  end

  def attachment_label
    attachment&.filename&.to_s || "(no attachment)"
  rescue ActiveSupport::DelegationError
    "(no attachment)"
  end
end
