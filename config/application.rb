require_relative "boot"

require "rails/all"
require "devise"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Go3
  class Application < Rails::Application
    config.active_record.query_log_tags_enabled = true
    config.active_record.query_log_tags = [
      # Rails query log tags:
      :application, :controller, :action, :job,
      # GraphQL-Ruby query log tags:
      current_graphql_operation: -> { GraphQL::Current.operation_name },
      current_graphql_field: -> { GraphQL::Current.field&.path },
      current_dataloader_source: -> { GraphQL::Current.dataloader_source_class }
    ]
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configure Active Storage image processor fallbacks
    # Use vips for processing variants by default, fallback to mini_magick
    config.active_storage.variant_processor = :vips
    config.active_storage.web_image_content_types = %w[image/png image/jpeg image/gif image/webp]

    # Configure available locales
    config.i18n.available_locales = [ :en, :fa ]
    config.i18n.default_locale = :en
    config.i18n.fallbacks = true
    config.i18n.fallbacks = [ I18n.default_locale, :fa ]

    config.autoload_paths << Rails.root.join("app/systems")
    config.eager_load_paths << Rails.root.join("app/systems")

    Rails.autoloaders.main.collapse(Rails.root.join("app/systems/*/models"))
    Rails.autoloaders.main.collapse(Rails.root.join("app/systems/*/controllers"))
    Rails.autoloaders.main.collapse(Rails.root.join("app/systems/*/policies"))
    Rails.autoloaders.main.collapse(Rails.root.join("app/systems/*/serializers"))
    Rails.autoloaders.main.collapse(Rails.root.join("app/systems/*/services"))
  end
end
