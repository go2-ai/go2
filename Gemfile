source "https://rubygems.org"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 8.0.1"
# The modern asset pipeline for Rails [https://github.com/rails/propshaft]
gem "propshaft"
# Use postgresql as the database for Active Record
gem "pg", "~> 1.1"
# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"
# Use JavaScript with ESM import maps [https://github.com/rails/importmap-rails]
gem "importmap-rails"
# Hotwire's SPA-like page accelerator [https://turbo.hotwired.dev]
gem "turbo-rails"
# Hotwire's modest JavaScript framework [https://stimulus.hotwired.dev]
gem "stimulus-rails"
# Build JSON APIs with ease [https://github.com/rails/jbuilder]
gem "jbuilder"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"

# Authentication
gem "devise"  # Flexible authentication solution
gem "omniauth" # Authentication framework supporting multiple providers
gem "omniauth-google-oauth2" # Google OAuth2 strategy for OmniAuth
gem "omniauth-facebook" # Facebook strategy for OmniAuth
gem "omniauth-apple" # Apple Sign-in strategy for OmniAuth
gem "omniauth-linkedin-oauth2" # LinkedIn strategy for OmniAuth
gem "omniauth-rails_csrf_protection" # CSRF protection for OmniAuth

# Multi-Factor Authentication
gem "rotp", "~> 6.0"
gem "rqrcode", "~> 3.1"
gem "twilio-ruby" # Twilio API client for SMS-based verification

# Security
gem "rack-attack" # Rack middleware for blocking & throttling abusive requests
gem "recaptcha" # reCAPTCHA helper for Ruby apps

# Authorization
gem "pundit" # Minimal authorization through OO design and pure Ruby classes

# Soft deletion / archiving
gem "acts_as_archival", "~> 2.0" # Records can be archived and unarchived, instead of destroyed

# Internationalization
gem "http_accept_language" # Parse Accept-Language header

# Translations
gem "mobility", "~> 1.2" # Translate ActiveRecord models
gem "paper_trail" # Track changes to models

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Use the database-backed adapters for Rails.cache, Active Job, and Action Cable
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Deploy this application anywhere as a Docker container [https://kamal-deploy.org]
gem "kamal", require: false

# Add HTTP asset caching/compression and X-Sendfile acceleration to Puma [https://github.com/basecamp/thruster/]
gem "thruster", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
gem "image_processing", "~> 1.2"
gem "dotenv-rails"

gem "rswag-api"
gem "rswag-ui"



gem "tailwindcss-rails", "~> 4.3"
gem "tailwindcss-ruby", "~> 4.1"

# Email SMTP delivery
gem "net-smtp", require: false
gem "net-imap", require: false
gem "net-pop", require: false


# Excel generation
gem "axlsx", "~> 1.3.6"
gem "axlsx_rails", "~> 0.6"
gem "graphql"
gem "faker"
gem "blueprinter"

# storage
gem "aws-sdk-s3", require: false
gem "rubyzip"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"

  # Static analysis for security vulnerabilities [https://brakemanscanner.org/]
  gem "brakeman", require: false

  # Omakase Ruby styling [https://github.com/rails/rubocop-rails-omakase/]
  gem "rubocop-rails-omakase", require: false

  # Testing
  gem "rspec-rails", "~> 6.1.0"
  gem "factory_bot_rails"
  gem "shoulda-matchers"

  gem "database_cleaner-active_record"

  gem "hotwire-livereload"

  gem "rswag-specs"
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "web-console"

  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem "rack-mini-profiler"

  # Preview email in the browser instead of sending it
  gem "letter_opener"
  # gem "mailcatcher" # Optional: Install separately with `gem install mailcatcher`
  gem "rubocop", "~> 1.75"
  gem "lefthook"
  gem "bullet"
  gem "i18n-tasks", "~> 1.0.15", group: :development
end

group :test do
  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem "capybara"
  gem "selenium-webdriver", "~> 4.34"
  gem "simplecov", require: false
end
gem "graphiql-rails", group: :development
