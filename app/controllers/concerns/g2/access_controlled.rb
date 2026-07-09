module G2::AccessControlled
  extend ActiveSupport::Concern

  included do
    before_action :enforce_g2_system_access!
  end

  class_methods do
    # Use in a controller that belongs to a specific module, e.g.:
    #   class JournalEntriesController < ApplicationController
    #     include G2::AccessControlled
    #     requires_g2_module "accounting"
    #   end
    def requires_g2_module(module_key)
      before_action -> { enforce_g2_module_access!(module_key) }
    end
  end

  private

  # Whole-system check - blocks EVERYTHING except login/billing once the
  # trial's over and no module grants access at all.
  def enforce_g2_system_access!
    return unless current_organization

    if G2::AccessGate.new(current_organization).system_locked?
      render json: {
        error: "This organization's access has expired. Please subscribe to continue.",
        locked: true
      }, status: :payment_required # 402
    end
  end

  # Per-module check - use requires_g2_module in controllers that belong
  # to ONE specific module. A lapsed module blocks only its own features.
  def enforce_g2_module_access!(module_key)
    return unless current_organization

    unless G2::AccessGate.new(current_organization).module_accessible?(module_key)
      render json: {
        error: "Access to #{module_key} requires an active subscription.",
        locked: true,
        module: module_key
      }, status: :payment_required
    end
  end
end