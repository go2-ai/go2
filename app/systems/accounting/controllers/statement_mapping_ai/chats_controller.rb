module Accounting
  module StatementMappingAi
    # The mapping assistant of one statement report (the chat's subject):
    # POST /chats, GET /chats/:id, POST /chats/:id/messages,
    # POST /chats/:id/abandon (from Ai::BaseChatsController), plus
    # GET /chats/:id/preview and POST /chats/:id/accept.
    #
    # Needs Reports.manage_statements and edit access to the report.
    class ChatsController < Ai::BaseChatsController
      include Accounting::ReportRunErrors

      # Redeclared (same method) to add :preview; the base declares the others.
      before_action :load_chat, only: [ :show, :post_message, :abandon, :accept, :preview ]

      # The inspection list and checks with the proposal's selected changes
      # (indexes, default all) applied; run params as for the inspection.
      def preview
        proposal = current_proposal
        return render json: { errors: [ I18n.t("controllers.statement_mapping_ai.errors.no_proposal") ] }, status: :not_found unless proposal

        selected = proposal.selection(indexes_param)
        errors = proposal.errors(selected)
        return render json: { errors: errors.map(&:to_s) }, status: :unprocessable_content if errors.any?

        proposed = Accounting::Statements::ProposedRules.parse(@report.statement_layout, proposal.merged_entries(selected))
        columns = Accounting::Statements::ReportType.columns(@report, current_organization, params.merge(comparison: false))
        payload = Accounting::Statements::Inspection.new(report: @report, organization: current_organization,
                                                         column: columns.first, proposed_rules: proposed).call
        render json: payload.merge(changes: describe_changes(proposal)), status: :ok
      rescue Accounting::Statements::ProposedRules::Invalid => e
        render json: { errors: e.messages }, status: :unprocessable_content
      end

      # Applies the selected changes (indexes, default all) to the rules.
      def accept
        result = ApplyProposal.call(chat: @chat, indexes: indexes_param)
        if result.success?
          render json: { chat: chat_payload(@chat.reload), applied: result.applied,
                         layout: Accounting::Statements::LayoutPayload.new(@report.statement_layout, organization: current_organization).call },
                 status: :ok
        else
          render json: { errors: result.errors, chat: chat_payload(@chat) }, status: :unprocessable_content
        end
      end

      private

      def chat_kind
        "statement_mapping"
      end

      def job_class
        Accounting::StatementMappingAi::ProcessMessageJob
      end

      def chat_payload(chat)
        AiChatBlueprint.render_as_hash(chat, view: :with_messages)
      end

      # Instead of the organization admin check: edit access to the report
      # and the statements permission.
      def authorize_org
        @report = Reporting::Report.available_to(current_organization).find_by(id: params[:statement_id]) if current_organization
        raise ActiveRecord::RecordNotFound unless @report&.statement_layout

        access = Reporting::Access.new(current_user, current_organization)
        # Chats belong to a member (GO3 admins outside the organization have none).
        raise Pundit::NotAuthorizedError unless current_member && access.can_edit?(@report) && access.manage_statements?
      rescue ActiveRecord::RecordNotFound
        render json: { errors: [ I18n.t("controllers.reports.errors.not_found") ] }, status: :not_found
      end

      def chat_subject
        @report
      end

      def current_proposal
        raw = @chat.state["latest_proposal"]
        raw.present? ? Proposal.from(raw, layout: @report.statement_layout) : nil
      end

      def indexes_param
        return nil if params[:indexes].nil?

        raw = params[:indexes]
        (raw.is_a?(String) ? raw.split(",") : Array(raw)).map(&:to_i)
      end

      def describe_changes(proposal)
        proposal.changes.each_with_index.map { |change, index| change.merge("index" => index) }
      end
    end
  end
end
