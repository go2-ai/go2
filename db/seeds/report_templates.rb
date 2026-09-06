# System report templates (organization_id: nil)

def minimal_mrt_xml(report_name:, display_text:, guid:)
  <<~XML
    <?xml version="1.0" encoding="utf-8" standalone="yes"?>
    <StiSerializer version="1.02" type="Net" application="StiReport">
      <CalculationMode>Interpretation</CalculationMode>
      <Dictionary Ref="1" type="Dictionary" isKey="true">
        <BusinessObjects isList="true" count="0" />
        <Databases isList="true" count="0" />
        <DataSources isList="true" count="0" />
        <Relations isList="true" count="0" />
        <Report isRef="0" />
        <Resources isList="true" count="0" />
        <UserFunctions isList="true" count="0" />
        <Variables isList="true" count="0" />
      </Dictionary>
      <EngineVersion>EngineV2</EngineVersion>
      <GlobalizationStrings isList="true" count="0" />
      <Key>#{guid}</Key>
      <MetaTags isList="true" count="0" />
      <Pages isList="true" count="1">
        <Page1 Ref="2" type="Page" isKey="true">
          <Border>None;Black;2;Solid;False;4;Black</Border>
          <Brush>Transparent</Brush>
          <Components isList="true" count="1">
            <Text1 Ref="3" type="Text" isKey="true">
              <Brush>Transparent</Brush>
              <ClientRectangle>1.1,0.3,3.5,0.9</ClientRectangle>
              <Conditions isList="true" count="0" />
              <Expressions isList="true" count="0" />
              <Font>Arial,8</Font>
              <Name>Text1</Name>
              <Page isRef="2" />
              <Parent isRef="2" />
              <Text>#{display_text}</Text>
              <TextBrush>Black</TextBrush>
              <Type>Expression</Type>
            </Text1>
          </Components>
          <Conditions isList="true" count="0" />
          <Expressions isList="true" count="0" />
          <Guid>#{guid}</Guid>
          <Margins>0.39,0.39,0.39,0.39</Margins>
          <Name>Page1</Name>
          <PageHeight>11</PageHeight>
          <PageWidth>8.5</PageWidth>
          <PaperSize>Letter</PaperSize>
          <Report isRef="0" />
        </Page1>
      </Pages>
      <ReferencedAssemblies isList="true" count="8">
        <value>System.Dll</value>
        <value>System.Drawing.Dll</value>
        <value>System.Windows.Forms.Dll</value>
        <value>System.Data.Dll</value>
        <value>System.Xml.Dll</value>
        <value>Stimulsoft.Controls.Dll</value>
        <value>Stimulsoft.Base.Dll</value>
        <value>Stimulsoft.Report.Dll</value>
      </ReferencedAssemblies>
      <ReportAlias>#{report_name}</ReportAlias>
      <ReportAuthor>System</ReportAuthor>
      <ReportChanged>#{Time.current.strftime('%-m/%-d/%Y %-I:%M:%S %p')}</ReportChanged>
      <ReportCreated>#{Time.current.strftime('%-m/%-d/%Y %-I:%M:%S %p')}</ReportCreated>
      <ReportFile>Report.mrt</ReportFile>
      <ReportGuid>#{guid}</ReportGuid>
      <ReportName>#{report_name}</ReportName>
      <ReportUnit>Inches</ReportUnit>
      <ReportVersion>2026.3.3.0</ReportVersion>
      <Script>using System;
    using System.Drawing;
    using System.Windows.Forms;
    using System.Data;
    using Stimulsoft.Controls;
    using Stimulsoft.Base.Drawing;
    using Stimulsoft.Report;
    using Stimulsoft.Report.Dialogs;
    using Stimulsoft.Report.Components;
    namespace Reports
    {
        public class Report : Stimulsoft.Report.StiReport
        {
            public Report()        {
                this.InitializeComponent();
            }
            #region StiReport Designer generated code - do not modify
    		#endregion StiReport Designer generated code - do not modify
        }
    }
    </Script>
      <ScriptLanguage>CSharp</ScriptLanguage>
      <Styles isList="true" count="0" />
      <UsePlatformDependentScript>False</UsePlatformDependentScript>
    </StiSerializer>
  XML
end

report_templates = [
  {
    name: { "en" => "Journal Entry", "fa" => "سند حسابداری" },
    report_key: "journal_entry",
    template_file: minimal_mrt_xml(
      report_name: "JournalEntry",
      display_text: "Journal Entry",
      guid: SecureRandom.hex(16)
    )
  },
  {
    name: { "en" => "Explorer", "fa" => "کاوشگر" },
    report_key: "explorer",
    template_file: minimal_mrt_xml(
      report_name: "Explorer",
      display_text: "Explorer",
      guid: SecureRandom.hex(16)
    )
  },
  {
    name: { "en" => "Journal Entry Items", "fa" => "آرتیکل‌های سند" },
    report_key: "journal_entry_items",
    template_file: minimal_mrt_xml(
      report_name: "JournalEntryItems",
      display_text: "Journal Entry Items",
      guid: SecureRandom.hex(16)
    )
  }
]

report_templates.each do |attrs|
  ReportTemplate.find_or_create_by!(
    report_key: attrs[:report_key],
    organization_id: nil
  ) do |template|
    template.name = attrs[:name]
    template.template_file = attrs[:template_file]
    template.is_default = true
  end
end

puts "Seeded #{ReportTemplate.system.count} system report templates"
