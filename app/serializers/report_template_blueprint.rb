class ReportTemplateBlueprint < Blueprinter::Base
  identifier :id

  fields :report_key, :template_file, :parent_template_id, :is_default, :created_at, :updated_at

  field :name do |template|
    template.name
  end

  field :t do |template|
    { name: template.read_attribute(:name) }
  end

  field :system do |template|
    template.system?
  end

  field :created_by_name do |template|
    template.created_by&.name
  end
end
