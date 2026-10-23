# Helpers for specs that need organizations in other languages.
module OrganizationHelpers
  # An organization whose primary locale is Persian. It is created in English
  # first: its default records (e.g. the main currency) are named in the
  # current locale on create.
  def persian_organization(active_locales: [])
    organization = FactoryBot.create(:organization, name: { "en" => "Organization", "fa" => "سازمان" })
    organization.update!(locale: "fa", active_locales: active_locales)
    organization
  end
end

RSpec.configure do |config|
  config.include OrganizationHelpers
end
