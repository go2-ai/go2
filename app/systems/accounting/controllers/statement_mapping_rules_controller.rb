module Accounting
  # Mapping rules of an organization's statement report.
  class StatementMappingRulesController < ApplicationController
    include StatementReportContext

    before_action -> { authorize @report, :edit_mapping? }
    before_action :set_rule, only: [ :update, :destroy ]

    def create
      rule = @layout.rules.new(rule_params)
      rule.position = (@layout.rules.maximum(:position) || 0) + 1
      return render_errors(rule) unless rule.save

      render json: layout_json.merge(rule_id: rule.id), status: :created
    end

    def update
      @rule.assign_attributes(rule_params)
      return render_errors(@rule) unless @rule.save

      render json: layout_json, status: :ok
    end

    def destroy
      @rule.destroy!
      render json: layout_json, status: :ok
    end

    private

    def set_rule
      @rule = @layout.rules.find_by(id: params[:id])
      render json: { errors: [ controller_t("errors.not_found") ] }, status: :not_found unless @rule
    end

    def rule_params
      permitted = params.permit(:statement_line_id, :opposite_line_id, :selector_type, :center_level, :grain, :measure,
                                :priority, :note, center_ids: [], center_type_ids: [], currency_ids: [],
                                selector: [ :from, :to, :period, { ids: [], identifiers: [], settings: [] } ]).to_h
      %i[center_ids center_type_ids currency_ids].each do |key|
        permitted[key] = Array(permitted[key]).compact_blank.map(&:to_i) if permitted.key?(key)
      end
      if permitted[:selector].is_a?(Hash) && permitted[:selector]["ids"]
        permitted[:selector]["ids"] = Array(permitted[:selector]["ids"]).compact_blank.map(&:to_i)
      end
      permitted[:priority] = permitted[:priority].presence
      permitted[:center_level] = permitted[:center_level].presence if permitted.key?(:center_level)
      permitted[:opposite_line_id] = permitted[:opposite_line_id].presence if permitted.key?(:opposite_line_id)
      permitted
    end
  end
end
