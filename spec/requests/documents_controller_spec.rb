# spec/requests/documents_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Documents API', type: :request do
  document_attributes = {
    id: { type: :integer, example: 1 },
    documentable_type: { type: :string, example: 'Accounting::JournalEntry' },
    documentable_id: { type: :integer, example: 1 },
    created_at: { type: :string, example: '2026-09-02 10:52:46.787878000 +0000' },
    name: { type: :string, example: 'report.pdf' },
    size: { type: :integer, example: 24576 },
    content_type: { type: :string, example: 'application/pdf' },
    uploaded_by: { type: %i[string null], example: 'John Doe' },
    previewable: { type: :boolean, example: true },
    url: { type: :string, example: '/rails/active_storage/blobs/...' }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization:, user:) }
  let(:journal_entry) { create(:accounting_journal_entry, organization:) }

  before { sign_in user }

  path '/organizations/{organization_id}/documents' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get documents for a documentable' do
      tags 'Documents'
      produces 'application/json'

      parameter name: :documentable_type, in: :query, type: :string, required: true, description: 'Polymorphic documentable type'
      parameter name: :documentable_id, in: :query, type: :integer, required: true, description: 'Polymorphic documentable ID'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: document_attributes }

        let(:organization_id) { organization.id }
        let(:documentable_type) { 'Accounting::JournalEntry' }
        let(:documentable_id) { journal_entry.id }

        before do
          create(:document, organization:, documentable: journal_entry)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.length).to eq(1)
          expect(data[0]['name']).to eq('test.txt')
        end
      end
    end

    post 'Upload a document' do
      tags 'Documents'
      consumes 'multipart/form-data'
      produces 'application/json'

      parameter name: :documentable_type, in: :formData, type: :string, required: true, description: 'Polymorphic documentable type'
      parameter name: :documentable_id, in: :formData, type: :integer, required: true, description: 'Polymorphic documentable ID'
      parameter name: :attachment, in: :formData, type: :file, required: true, description: 'File to upload'

      response '200', 'Document uploaded successfully' do
        schema type: :object, properties: document_attributes

        let(:organization_id) { organization.id }
        let(:documentable_type) { 'Accounting::JournalEntry' }
        let(:documentable_id) { journal_entry.id }
        let(:attachment) { Rack::Test::UploadedFile.new(StringIO.new('test content'), 'text/plain', original_filename: 'test.txt') }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['name']).to eq('test.txt')
          expect(data['previewable']).to be true
        end
      end

      response '422', 'Unsupported file type' do
        schema type: :object, properties: { errors: { type: :array, items: { type: :string } } }

        let(:organization_id) { organization.id }
        let(:documentable_type) { 'Accounting::JournalEntry' }
        let(:documentable_id) { journal_entry.id }
        let(:attachment) { Rack::Test::UploadedFile.new(StringIO.new('bad content'), 'application/zip', original_filename: 'test.zip') }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/documents/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Document ID', required: true

    get 'Get a document' do
      tags 'Documents'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: document_attributes

        let(:organization_id) { organization.id }
        let(:id) { create(:document, organization:, documentable: journal_entry).id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(id)
        end
      end

      response '404', 'Not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    delete 'Delete a document' do
      tags 'Documents'
      produces 'application/json'

      response '200', 'Document deleted successfully' do
        schema type: :object, properties: document_attributes

        let(:organization_id) { organization.id }
        let(:id) { create(:document, organization:, documentable: journal_entry).id }

        run_test! do |response|
          expect(Document.find_by(id: id)).to be_nil
        end
      end

      response '404', 'Not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end

  path '/organizations/{organization_id}/documents/{id}/download' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Document ID', required: true

    get 'Download a document' do
      tags 'Documents'
      produces 'application/octet-stream'

      response '302', 'Redirects to Active Storage URL' do
        let(:organization_id) { organization.id }
        let(:id) { create(:document, organization:, documentable: journal_entry).id }

        run_test! do |response|
          expect(response).to have_http_status(:found)
        end
      end
    end
  end
end