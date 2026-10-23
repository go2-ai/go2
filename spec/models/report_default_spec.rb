require "rails_helper"

RSpec.describe ReportDefault, type: :model do
  let(:organization) { create(:organization) }
  let(:template) { create(:report_template) }

  it "can point at a system template or one of the organization's" do
    expect(build(:report_default, organization: organization, report_template: template)).to be_valid
    own = create(:report_template, organization: organization)
    expect(build(:report_default, organization: organization, report_template: own)).to be_valid
  end

  it "rejects templates of other organizations or reports" do
    foreign = create(:report_template, organization: create(:organization))
    expect(build(:report_default, organization: organization, report_template: foreign)).not_to be_valid

    other_report = create(:report_template, report_key: "currency_revaluation")
    expect(build(:report_default, organization: organization, report_template: other_report, report_key: "journal_entry"))
      .not_to be_valid
  end

  it "rejects unknown reports and members of other organizations" do
    expect(build(:report_default, organization: organization, report_template: template, report_key: "unknown")).not_to be_valid

    stranger = create(:member, organization: create(:organization))
    expect(build(:report_default, organization: organization, member: stranger, report_template: template)).not_to be_valid
  end

  it "allows one organization default and one default per member for a report" do
    member = create(:member, organization: organization)
    create(:report_default, organization: organization, report_template: template)
    create(:report_default, organization: organization, member: member, report_template: template)

    expect(build(:report_default, organization: organization, report_template: template)).not_to be_valid
    expect(build(:report_default, organization: organization, member: member, report_template: template)).not_to be_valid
  end
end
