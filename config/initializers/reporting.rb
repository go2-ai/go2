# Report types of the reporting platform (see Reporting::ReportTypes).
Rails.application.config.to_prepare do
  Reporting::ReportTypes.register("accounting.statement", "Accounting::Statements::ReportType")
  Reporting::ReportTypes.register("accounting.trial_balance", "Accounting::TrialBalance::ReportType")
  Reporting::ReportTypes.register("accounting.ratios", "Accounting::Ratios::ReportType")
end
