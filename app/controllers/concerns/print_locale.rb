# Print data follows the language of the printed template, not the user's:
# ?locale=fa renders translated labels (I18n) and names (Mobility) in Persian.
# Locales the app has no translations for fall back to the default locale
# (translated names then use Mobility's fallbacks).
module PrintLocale
  extend ActiveSupport::Concern

  private

  def with_print_locale(&block)
    requested = params[:locale].to_s
    return yield if requested.blank?

    locale = I18n.available_locales.map(&:to_s).include?(requested) ? requested : I18n.default_locale
    I18n.with_locale(locale) { Mobility.with_locale(locale, &block) }
  end
end
