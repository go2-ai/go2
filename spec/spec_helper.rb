require 'simplecov'
SimpleCov.start 'rails' do
  track_files '{app,lib}/**/*.rb'
  add_filter '/spec/'
  add_group 'Accounting',   'app/systems/accounting'

  add_group 'Models',       'app/models'
  add_group 'Controllers',  'app/controllers'
  add_group 'Mailers',      'app/mailers'
  add_group 'Helpers',      'app/helpers'
  add_group 'Policies',     'app/policies'
  add_group 'Serializers',  'app/serializers'

  # Your app has a nested "systems" namespace (e.g. app/systems/accounting/*)
end

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Custom matchers
  RSpec::Matchers.define :be_versioned do
    match do |actual|
      actual.class.included_modules.include?(PaperTrail::Model::InstanceMethods)
    end
  end
end
