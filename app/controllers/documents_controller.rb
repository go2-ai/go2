class DocumentsController < ApplicationController
  before_action :set_organization
  before_action :set_document, only: [ :show, :destroy, :download ]

  def index
    documents = @organization.documents
      .where(documentable_type: params[:documentable_type], documentable_id: params[:documentable_id])
      .with_attached_attachment
      .order(created_at: :desc)

    render json: DocumentBlueprint.render(documents), status: :ok
  end

  def show
    render json: DocumentBlueprint.render(@document), status: :ok
  end

  def create
    document = @organization.documents.new(document_params)
    document.member = current_member

    if document.save
      render json: DocumentBlueprint.render(document), status: :ok
    else
      render json: { errors: document.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    if @document.destroy
      render json: DocumentBlueprint.render(@document), status: :ok
    else
      render json: { errors: @document.errors.full_messages }, status: :unprocessable_content
    end
  end

  def download
    redirect_to rails_blob_url(@document.attachment, disposition: "attachment")
  end

  def zip
    document_ids = params[:document_ids] || []
    documents = @organization.documents.where(id: document_ids).with_attached_attachment

    if documents.empty?
      render json: { errors: [ "No documents selected" ] }, status: :unprocessable_content
      return
    end

    zip_data = generate_zip(documents)
    send_data zip_data,
              filename: "documents_#{Date.current}.zip",
              type: "application/zip",
              disposition: "attachment"
  end

  private

  def set_organization
    @organization = current_organization
    render json: { errors: [ "Organization not found" ] }, status: :not_found unless @organization
  end

  def set_document
    @document = @organization.documents.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { errors: [ "Document not found" ] }, status: :not_found
  end

  def document_params
    params.permit(:documentable_type, :documentable_id, :attachment)
  end

  def generate_zip(documents)
    require "zip"

    stringio = Zip::OutputStream.write_buffer do |zio|
      documents.each do |document|
        blob = document.attachment.blob
        zio.put_next_entry(document.display_name)
        zio.write(blob.download)
      end
    end

    stringio.string
  end
end