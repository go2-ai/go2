# The request throttles (config/initializers/rack_attack.rb) count every
# request of the suite from the same IP; start each example with empty
# counters so the suite's size doesn't make later specs answer 429.
RSpec.configure do |config|
  config.before do
    Rack::Attack.reset! if defined?(Rack::Attack)
  end
end
