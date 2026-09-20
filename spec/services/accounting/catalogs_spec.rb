# frozen_string_literal: true

require "rails_helper"
require "tmpdir"
require "pathname"

RSpec.describe Accounting::Catalogs do
  describe "with the shipped catalog directory" do
    describe ".available" do
      it "returns the shipped catalog keys as strings" do
        keys = described_class.available
        expect(keys).to include("service_company")
        expect(keys).to all(be_a(String))
      end

      it "returns keys in sorted order" do
        expect(described_class.available).to eq(described_class.available.sort)
      end
    end

    describe ".load('service_company')" do
      subject(:catalog) { described_class.load("service_company") }

      it "returns a Hash with the key field set" do
        expect(catalog).to be_a(Hash)
        expect(catalog[:key]).to eq("service_company")
      end

      it "includes label and description with at least an :en translation" do
        expect(catalog[:label]).to be_a(Hash)
        expect(catalog[:label][:en]).to be_a(String)
        expect(catalog[:label][:fa]).to be_a(String)

        expect(catalog[:description]).to be_a(Hash)
        expect(catalog[:description][:en]).to be_a(String)
      end

      it "returns non-empty ledgers and accounts arrays" do
        expect(catalog[:ledgers]).to be_an(Array)
        expect(catalog[:ledgers]).not_to be_empty

        expect(catalog[:accounts]).to be_an(Array)
        expect(catalog[:accounts]).not_to be_empty
      end

      it "symbolizes every ledger entry" do
        catalog[:ledgers].each do |ledger|
          expect(ledger).to have_key(:category)
          expect(ledger).to have_key(:code)
          expect(ledger).to have_key(:name)
          expect(ledger[:name]).to have_key(:en)
          expect(ledger).to have_key(:unexpected_balance)
          expect(ledger).to have_key(:is_monetary)
        end
      end

      it "symbolizes every account entry" do
        catalog[:accounts].each do |account|
          expect(account).to have_key(:ledger)
          expect(account).to have_key(:code)
          expect(account).to have_key(:name)
          expect(account[:name]).to have_key(:en)
          expect(account).to have_key(:accepts_other_currencies)
        end
      end

      it "references only system category identifiers" do
        identifiers = catalog[:ledgers].map { |l| l[:category] }.uniq
        expect(identifiers).to all(satisfy { |id| described_class::SYSTEM_CATEGORY_IDENTIFIERS.include?(id) })
      end

      it "resolves every account's ledger reference" do
        ledger_refs = catalog[:ledgers].map { |l| "#{l[:category]}.#{l[:code]}" }
        catalog[:accounts].each do |account|
          expect(ledger_refs).to include(account[:ledger])
        end
      end
    end

    describe ".load with an unknown key" do
      it "raises NotFoundError" do
        expect { described_class.load("does_not_exist") }
          .to raise_error(Accounting::Catalogs::NotFoundError, /does_not_exist/)
      end

      it "coerces symbol keys to strings" do
        expect { described_class.load(:nope) }
          .to raise_error(Accounting::Catalogs::NotFoundError, /nope/)
      end
    end
  end

  describe "with a fixture catalog directory" do
    around do |example|
      Dir.mktmpdir do |dir|
        @fixture_dir = Pathname.new(dir)
        example.run
      end
    end

    before do
      allow(described_class).to receive(:catalogs_dir).and_return(@fixture_dir)
    end

    def write_catalog(filename, contents)
      File.write(@fixture_dir.join(filename), contents)
    end

    describe ".available" do
      it "returns an empty array when the directory has no YAML files" do
        expect(described_class.available).to eq([])
      end

      it "returns only .yml files as keys" do
        write_catalog("alpha.yml", minimal_catalog("alpha"))
        write_catalog("notes.txt", "ignore me")
        expect(described_class.available).to eq([ "alpha" ])
      end
    end

    describe "structural validation" do
      it "rejects a catalog whose `key` does not match the filename" do
        write_catalog("wrong.yml", minimal_catalog("something_else").sub("something_else", "something_else"))

        expect { described_class.load("wrong") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /key.*something_else/)
      end

      it "rejects a catalog missing a top-level `label` with `en`" do
        write_catalog("nolabel.yml", <<~YAML)
          key: nolabel
          description:
            en: No label here.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: true
          accounts:
            - ledger: CA.10
              code: "01"
              name: { en: Cash }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("nolabel") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /`label` must be a Hash/)
      end

      it "rejects a non-empty `categories` list (v1 restriction)" do
        write_catalog("withcat.yml", <<~YAML)
          key: withcat
          label:
            en: With Cat
            fa: با دسته
          description:
            en: Test.
          categories:
            - code: "0"
              name: { en: Custom }
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: true
          accounts:
            - ledger: CA.10
              code: "01"
              name: { en: Cash }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("withcat") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /custom `categories` are not supported/)
      end

      it "rejects an empty ledgers array" do
        write_catalog("emptyl.yml", <<~YAML)
          key: emptyl
          label:
            en: Empty
            fa: خالی
          description:
            en: Test.
          categories: []
          ledgers: []
          accounts: []
        YAML

        expect { described_class.load("emptyl") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /`ledgers` must be a non-empty Array/)
      end

      it "rejects an empty accounts array" do
        write_catalog("emptya.yml", <<~YAML)
          key: emptya
          label:
            en: Empty
            fa: خالی
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: true
          accounts: []
        YAML

        expect { described_class.load("emptya") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /`accounts` must be a non-empty Array/)
      end

      it "rejects a ledger with an unknown category" do
        write_catalog("badcat.yml", <<~YAML)
          key: badcat
          label:
            en: Bad Cat
            fa: بد
          description:
            en: Test.
          categories: []
          ledgers:
            - category: XX
              code: "10"
              name: { en: Nope }
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: XX.10
              code: "01"
              name: { en: Nope }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("badcat") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /unknown category "XX"/)
      end

      it "rejects a ledger missing a name" do
        write_catalog("noname.yml", <<~YAML)
          key: noname
          label:
            en: No Name
            fa: بی‌نام
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: CA.10
              code: "01"
              name: { en: X }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("noname") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /ledger #0 must have a non-empty `name` Hash/)
      end

      it "rejects duplicate ledgers" do
        write_catalog("dupl.yml", <<~YAML)
          key: dupl
          label:
            en: Dup
            fa: تکراری
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: One }
              unexpected_balance: accept
              is_monetary: false
            - category: CA
              code: "10"
              name: { en: Two }
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: CA.10
              code: "01"
              name: { en: A }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("dupl") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /duplicate ledger CA\.10/)
      end

      it "rejects an account that references a missing ledger" do
        write_catalog("orphan.yml", <<~YAML)
          key: orphan
          label:
            en: Orphan
            fa: یتیم
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: CA.99
              code: "01"
              name: { en: Missing }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("orphan") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /CA\.99.*not defined/)
      end

      it "rejects duplicate accounts within a ledger" do
        write_catalog("dupa.yml", <<~YAML)
          key: dupa
          label:
            en: Dup A
            fa: تکراری الف
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: CA.10
              code: "01"
              name: { en: One }
              accepts_other_currencies: false
            - ledger: CA.10
              code: "01"
              name: { en: Two }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("dupa") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /duplicate account CA\.10\.01/)
      end

      it "rejects an account whose `ledger` field is not a dotted string" do
        write_catalog("badref.yml", <<~YAML)
          key: badref
          label:
            en: Bad Ref
            fa: بد
          description:
            en: Test.
          categories: []
          ledgers:
            - category: CA
              code: "10"
              name: { en: Cash }
              unexpected_balance: accept
              is_monetary: false
          accounts:
            - ledger: "not a dotted string"
              code: "01"
              name: { en: X }
              accepts_other_currencies: false
        YAML

        expect { described_class.load("badref") }
          .to raise_error(Accounting::Catalogs::InvalidCatalogError, /must be a '<category>.<ledger_code>' string/)
      end
    end
  end

  def minimal_catalog(key)
    <<~YAML
      key: #{key}
      label:
        en: Minimal
        fa: حداقلی
      description:
        en: Test.
      categories: []
      ledgers:
        - category: CA
          code: "10"
          name: { en: Cash }
          unexpected_balance: accept
          is_monetary: false
      accounts:
        - ledger: CA.10
          code: "01"
          name: { en: Cash }
          accepts_other_currencies: false
    YAML
  end
end
