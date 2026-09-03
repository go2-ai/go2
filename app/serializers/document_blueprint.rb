class DocumentBlueprint < Blueprinter::Base
  identifier :id

  fields :documentable_type, :documentable_id, :created_at

  field :name do |document|
    document.display_name
  end

  field :size do |document|
    document.attachment.byte_size
  end

  field :content_type do |document|
    document.attachment.content_type
  end

  field :uploaded_by do |document|
    document.uploaded_by
  end

  field :previewable do |document|
    document.previewable?
  end

  field :url do |document|
    Rails.application.routes.url_helpers.rails_blob_path(
      document.attachment,
      only_path: true
    )
  end
end
