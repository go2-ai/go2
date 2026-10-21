# app/systems/accounting/services/revaluation/superseder.rb
module Accounting
  module Revaluation
    # Replaces posted temporary revaluations: deletes their entries and
    # marks them superseded (kept as history).
    class Superseder
      def initialize(revaluations)
        @revaluations = Array(revaluations)
      end

      def call
        revaluations.each do |revaluation|
          raise ArgumentError, "only temporary revaluations can be superseded" unless revaluation.temporary?

          Remover.destroy_entry!(revaluation)
          revaluation.update!(status: :superseded, superseded_at: Time.current)
        end
      end

      private

      attr_reader :revaluations
    end
  end
end
