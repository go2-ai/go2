class ReportTemplateBlueprint < Blueprinter::Base
  identifier :id

  # Lightweight fields for lists; template_file is only in the :show view.
  view :index do
    fields :report_key, :parent_template_id, :is_default, :created_at, :updated_at

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

    # What the current member may do (pass can_manage: when rendering).
    # System templates are read-only; any template can be copied.
    field :editable do |template, options|
      options[:can_manage] == true && template.org_specific?
    end

    field :copyable do |_template, options|
      options[:can_manage] == true
    end
  end

  view :show do
    include_view :index
    field :template_file
  end
end
