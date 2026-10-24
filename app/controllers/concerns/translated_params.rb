# Texts translated per locale ({ "en" => "...", "fa" => "..." }), limited
# to the organization's languages, stripped, blanks dropped.
module TranslatedParams
  extend ActiveSupport::Concern

  private

  def translated_param(key, organization: current_organization)
    raw = params[key]
    return {} unless raw.respond_to?(:permit) && organization

    raw.permit(*organization.available_locales).to_h.transform_values { |value| value.to_s.strip }
       .reject { |_, value| value.blank? }
  end
end
