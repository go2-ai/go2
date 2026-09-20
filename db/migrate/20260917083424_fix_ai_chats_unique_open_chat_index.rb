# db/migrate/20260917120000_fix_ai_chats_unique_open_chat_index.rb
class FixAiChatsUniqueOpenChatIndex < ActiveRecord::Migration[8.0]
  # The original index (organization_id, member_id, kind, status) was wrong
  # in two ways:
  #
  # 1. It enforced uniqueness across ALL statuses, so a member could only
  #    ever have ONE abandoned chat and ONE accepted chat, ever, per kind.
  #    The actual invariant is "at most one OPEN chat" — accepted/abandoned
  #    chats are a historical log and there can be arbitrarily many.
  #
  # 2. It didn't account for `subject` (the polymorphic, optional column
  #    already on this table). chart_of_accounts is org-scoped — subject is
  #    always nil, and "one open chat per kind" is correct. But a
  #    record-scoped feature (e.g. a future journal-entry assistant) needs
  #    "one open chat per kind PER SUBJECT" — a member should be able to
  #    have several open chats of that kind at once, one per journal entry.
  #
  # The correct key is (member_id, kind, subject_type, subject_id), scoped
  # to status = 'open'. organization_id is deliberately excluded: it's a
  # strict function of member_id (a member belongs to exactly one
  # organization, permanently — see AiChat#organization_matches_member for
  # where that invariant is now enforced explicitly), so it adds nothing to
  # the uniqueness key.
  #
  # Postgres treats NULL <> NULL, so a plain unique index on
  # (subject_type, subject_id) would let multiple org-scoped (subject-less)
  # chats coexist — the opposite of what we want for chart_of_accounts.
  # COALESCE-ing both columns to a sentinel makes nulls collide with each
  # other, which is exactly the "no subject" case we need to be unique too.
  def change
    add_index :ai_chats,
              "member_id, kind, COALESCE(subject_type, ''), COALESCE(subject_id, 0)",
              unique: true,
              where: "status = 'open'",
              name: "index_ai_chats_on_owner_kind_subject_open"
  end
end