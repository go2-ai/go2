class ReportTemplateBlueprint < Blueprinter::Base
  identifier :id

  # Lightweight fields for lists; template_file is only in the :show view.
  view :index do
    fields :report_key, :locale, :parent_template_id, :created_at, :updated_at

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

    # What the current member may do (pass access: a ReportRegistry::Access).
    # System templates are read-only; any template can be copied by those
    # who manage its report.
    field :editable do |template, options|
      template.org_specific? && options[:access]&.can_manage?(template.report_key) == true
    end

    field :copyable do |template, options|
      options[:access]&.can_manage?(template.report_key) == true
    end
  end

  view :show do
    include_view :index
    # Pass organization: so generated system templates fit it.
    field :template_file do |template, options|
      template.template_file_for(options[:organization])
    end
  end
end
