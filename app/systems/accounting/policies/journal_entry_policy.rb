# app/systems/accounting/policies/journal_entry_policy.rb
module Accounting
  class JournalEntryPolicy < ApplicationPolicy
    def index?
      view_journal_entries?
    end

    def show?
      view_journal_entries?
    end

    def create?
      manage_journal_entries?
    end

    def update?
      manage_journal_entries? && record_editable?
    end

    def destroy?
      manage_journal_entries? && record_editable?
    end

    def approve?
      approve_journal_entries? && record_approvable?
    end

    def unapprove?
      approve_journal_entries? && record_unapprovable?
    end

    private

    def view_journal_entries?
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES) ||
        member&.has_permission?(Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES) ||
        member&.has_permission?(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES)
    end

    def manage_journal_entries?
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES)
    end

    def approve_journal_entries?
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES)
    end

    def record_editable?
      return true if record.nil?
      record.draft? || record.booked?
    end

    def record_approvable?
      return false if record.nil?
      record.booked?
    end

    def record_unapprovable?
      return false if record.nil?
      record.approved?
    end
  end
end
