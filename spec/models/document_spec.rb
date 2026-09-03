require 'rails_helper'

RSpec.describe Document, type: :model do
  let(:organization) { create(:organization) }
  let(:member) { create(:member, organization: organization) }
  let(:journal_entry) { create(:accounting_journal_entry, organization: organization) }

  def build_document(content_type: "text/plain", size: 1.kilobyte, filename: "test.txt")
    document = Document.new(
      organization: organization,
      documentable: journal_entry,
      member: member
    )
    document.attachment.attach(
      io: StringIO.new("x" * size),
      filename: filename,
      content_type: content_type
    )
    document
  end

  describe "validations" do
    it "is valid with a whitelisted content type and acceptable size" do
      document = build_document
      expect(document).to be_valid
    end

    it "requires an attachment" do
      document = Document.new(
        organization: organization,
        documentable: journal_entry,
        member: member
      )
      expect(document).not_to be_valid
      expect(document.errors[:attachment]).to include("must be attached")
    end

    it "rejects non-whitelisted content types" do
      document = build_document(content_type: "application/zip")
      expect(document).not_to be_valid
      expect(document.errors[:attachment]).to include("has an unsupported file type")
    end

    it "rejects files exceeding organization max_file_size" do
      organization.update!(max_file_size: 1)
      document = build_document(size: 2.megabytes)
      expect(document).not_to be_valid
      expect(document.errors[:attachment].join).to include("exceeds the maximum file size")
    end

    it "rejects when total would exceed organization max_total_file_size" do
      organization.update!(max_total_file_size: 1, total_file_size: 1.megabyte - 1.kilobyte)
      document = build_document(size: 2.kilobytes)
      expect(document).not_to be_valid
      expect(document.errors[:attachment].join).to include("total storage limit")
    end
  end

  describe "callbacks" do
    it "increments organization total_file_size after create" do
      expect {
        build_document.save!
      }.to change { organization.reload.total_file_size }.by(1.kilobyte)
    end

    it "decrements organization total_file_size after destroy" do
      document = build_document
      document.save!
      expect {
        document.destroy
      }.to change { organization.reload.total_file_size }.by(-1.kilobyte)
    end
  end

  describe "#previewable?" do
    it "returns true for images" do
      document = build_document(content_type: "image/png")
      expect(document.previewable?).to be true
    end

    it "returns true for PDFs" do
      document = build_document(content_type: "application/pdf")
      expect(document.previewable?).to be true
    end

    it "returns true for text" do
      document = build_document(content_type: "text/plain")
      expect(document.previewable?).to be true
    end

    it "returns false for CSV" do
      document = build_document(content_type: "text/csv")
      expect(document.previewable?).to be false
    end
  end

  describe "#display_name" do
    it "returns attachment filename" do
      document = build_document(filename: "report.pdf")
      expect(document.display_name).to eq("report.pdf")
    end
  end
end
