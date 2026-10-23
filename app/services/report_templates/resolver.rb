# Picks the template to print a report with, for a member of an organization.
#
# - The default template: the member's own default, else the organization's
#   default, else the system template in the organization's locale.
# - The template for a locale ("print in Persian"): a default (personal,
#   then organization) written in that locale, else the system template in
#   that locale.
#
# System templates fall back to the organization's locale, then English, when
# none exists in the requested locale. Defaults written in a locale the
# organization no longer uses are ignored.
module ReportTemplates
  class Resolver
    attr_reader :organization, :member, :report_key

    def initialize(organization:, report_key:, member: nil)
      @organization = organization
      @member = member
      @report_key = report_key.to_s
    end

    # The organization's locales, its primary locale first.
    def locales
      @locales ||= ([ organization.locale ] | Array(organization.active_locales)).compact.map(&:to_s)
    end

    def organization_default
      return @organization_default if defined?(@organization_default)

      @organization_default = usable(defaults.find { |d| d.member_id.nil? }&.report_template)
    end

    def personal_default
      return @personal_default if defined?(@personal_default)

      @personal_default = member && usable(defaults.find { |d| d.member_id == member.id }&.report_template)
    end

    def default_template
      personal_default || organization_default || system_for(organization.locale)
    end

    def for_locale(locale)
      locale = locale.to_s
      [ personal_default, organization_default ].compact.find { |t| t.locale == locale } || system_for(locale)
    end

    # The system template in the locale, else in the organization's locale,
    # else in English.
    def system_for(locale)
      [ locale.to_s, organization.locale.to_s, ReportTemplate::FALLBACK_LOCALE ].uniq.each do |candidate|
        template = system_templates.find { |t| t.locale == candidate }
        return template if template
      end
      nil
    end

    # { "fa" => template, "en" => template } for the organization's locales.
    def by_locale
      locales.index_with { |locale| for_locale(locale) }
    end

    private

    def defaults
      @defaults ||= begin
        scope = ReportDefault.includes(:report_template).where(organization: organization, report_key: report_key)
        member ? scope.where(member_id: [ nil, member.id ]).to_a : scope.where(member_id: nil).to_a
      end
    end

    def system_templates
      @system_templates ||= ReportTemplate.system.where(report_key: report_key).to_a
    end

    def usable(template)
      template if template && locales.include?(template.locale)
    end
  end
end
