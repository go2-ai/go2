module Accounting
  # Lines of an organization's statement report. Answers with the whole
  # layout so the editor stays in sync (positions shift on moves).
  class StatementLinesController < ApplicationController
    include StatementReportContext
    before_action -> { authorize @report, :update? }
    before_action :set_line, only: [ :update, :destroy, :move ]

    def create
      line = @layout.lines.new(line_params.merge(key: params[:key].to_s.strip))
      line.position = next_position(line.parent_id)
      assign_label(line)
      return render_errors(line) unless line.save

      render json: layout_json.merge(line_id: line.id), status: :created
    end

    def update
      @line.assign_attributes(line_params)
      assign_label(@line)
      return render_errors(@line) unless @line.save

      render json: layout_json, status: :ok
    end

    def destroy
      return render_errors(@line) unless @line.destroy

      render json: layout_json, status: :ok
    end

    # parent_id (blank = top level) and index among the new siblings.
    def move
      parent_id = params[:parent_id].presence&.to_i
      # StatementLine validates the parent (same layout, no cycles).
      StatementLine.transaction do
        siblings = @layout.lines.where(parent_id: parent_id).where.not(id: @line.id).order(:position, :id).to_a
        index = params[:index].to_i.clamp(0, siblings.size)
        siblings.insert(index, @line)
        @line.parent_id = parent_id
        @line.position = (index + 1) * 10
        raise ActiveRecord::Rollback unless @line.save

        siblings.each_with_index { |line, i| line.update!(position: (i + 1) * 10) unless line.position == (i + 1) * 10 }
      end
      return render_errors(@line) if @line.errors.any?

      render json: layout_json, status: :ok
    end

    private

    def set_line
      @line = @layout.lines.find_by(id: params[:id])
      render json: { errors: [ controller_t("errors.not_found") ] }, status: :not_found unless @line
    end

    def line_params
      permitted = params.permit(:parent_id, :kind, :normal_side, :formula, style: %i[bold underline hide_if_zero hidden])
      permitted[:style] = permitted[:style].to_h.transform_values { |v| ActiveModel::Type::Boolean.new.cast(v) } if permitted.key?(:style)
      permitted
    end

    def assign_label(line)
      return unless params[:label].respond_to?(:permit)

      values = params[:label].permit(*@organization.available_locales).to_h.transform_values { |v| v.to_s.strip }
      # Blank values clear a translation.
      line.write_attribute(:label, line.read_attribute(:label).to_h.merge(values).reject { |_, v| v.blank? })
    end

    def next_position(parent_id)
      (@layout.lines.where(parent_id: parent_id).maximum(:position) || 0) + 10
    end
  end
end
