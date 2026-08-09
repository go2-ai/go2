# app/models/concerns/translation_helper.rb
module TranslationHelper
  extend ActiveSupport::Concern

  class_methods do
    def translatable_attributes
      self.mobility_attributes || []
    end

    def validates_uniqueness_of_translated(attribute, locales: nil, scope: nil, case_sensitive: true, message: nil, if: nil, unless: nil)
      validate_options = {}
      validate_options[:if] = binding.local_variable_get(:if) if binding.local_variable_get(:if)
      validate_options[:unless] = binding.local_variable_get(:unless) if binding.local_variable_get(:unless)

      validate(**validate_options) do |record|
        record.validate_translated_uniqueness(
          attribute,
          locales: locales,
          scope: scope,
          case_sensitive: case_sensitive,
          message: message
        )
      end
    end

    def validates_non_empty_translation(attribute, locales: [])
      validate do |record|
        # Evaluate locales if it's a lambda/proc
        evaluated_locales = if locales.respond_to?(:call)
          locales.call(record)
        else
          locales
        end

        record.validate_non_empty_translation(attribute, locales: evaluated_locales)
      end
    end
  end

  def translations_hash
    self.class.translatable_attributes.each_with_object({}) do |attribute, hash|
      raw_value = read_attribute(attribute)
      hash[attribute] = raw_value if raw_value.present?
    end
  end

  def as_json(options = {})
    super(options).merge("translations" => translations_hash)
  end

  def validate_translated_uniqueness(attribute, locales: nil, scope: nil, case_sensitive: true, message: nil)
    # Get the raw value from the database column
    raw_value = read_attribute(attribute)

    # Handle nil or non-hash values
    unless raw_value.is_a?(Hash)
      # If it's nil, there's nothing to validate for uniqueness
      return
    end

    # Filter out blank values
    translations = raw_value.reject { |_, v| v.blank? }
    return if translations.empty?

    # Determine which locales to check
    locales_to_check = locales || translations.keys
    locales_to_check = Array(locales_to_check).map(&:to_s)

    locales_to_check.each do |locale|
      value = translations[locale]
      next if value.blank?

      # Build the base query
      query = self.class.where.not(id: id || 0)

      # Add the translated attribute condition
      if case_sensitive
        query = query.where("#{attribute}->>? = ?", locale, value)
      else
        query = query.where("LOWER(#{attribute}->>?) = LOWER(?)", locale, value)
      end

      # Add scope if provided
      if scope.present?
        Array(scope).each do |scope_attr|
          scope_value = send(scope_attr)
          if scope_value.present?
            query = query.where(scope_attr => scope_value)
          end
        end
      end

      # Check if exists
      if query.exists?
        error_message = message || "#{locale} translation has already been taken"
        errors.add(attribute, error_message)
        break
      end
    end
  end

  def validate_non_empty_translation(attribute, locales: [])
    # Get the raw translations hash
    translations = read_attribute(attribute)

    # If no locales specified, check that at least one locale has a value
    if locales.empty?
      if translations.blank? || !translations.is_a?(Hash) || translations.values.all?(&:blank?)
        errors.add(attribute, "must contain at least one translation")
      end
    else
      # Check specific locales
      locales = Array(locales).map(&:to_s)

      # Ensure translations is a hash
      unless translations.is_a?(Hash)
        errors.add(attribute, "must contain at least one of the required translations: #{locales.join(', ')}")
        return
      end

      # Check if any of the specified locales has a non-blank value
      has_any_translation = locales.any? do |locale|
        translations[locale].present?
      end

      unless has_any_translation
        error_message = "must contain at least one of the following translations: #{locales.join(', ')}"
        errors.add(attribute, error_message)
      end
    end
  end
end
