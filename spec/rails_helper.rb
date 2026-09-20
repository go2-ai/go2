require "spec_helper"
ENV['RAILS_ENV'] ||= 'test'
require File.expand_path("../../config/environment", __FILE__)
require "rspec/rails"
Dir[Rails.root.join("spec/support/**/*.rb")].each { |f| require f }
require "webmock/rspec"
WebMock.disable_net_connect!(allow_localhost: true)

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!

  config.include Devise::Test::IntegrationHelpers, type: :request
  config.before(:each, type: :request) do
    Rails.application.reload_routes_unless_loaded
  end
end
