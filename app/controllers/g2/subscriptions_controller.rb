module G2
  class SubscriptionsController < ApplicationController
    before_action :authenticate_user!

    # POST /organizations/:organization_id/g2/subscriptions
    # Creates the subscription (pending until paid) AND its invoice in one
    # step, since a subscription is useless without something to pay.
    def create
      subscription = G2::Subscription.subscribe!(
        organization: current_organization,
        module_key: params[:module_key],
        plan: params[:plan],
        billing_period: params[:billing_period]
      )

      invoice = G2::Invoice.create_for_subscription!(subscription)

      render json: { subscription: subscription_json(subscription), invoice: invoice_json(invoice) },
             status: :created
    rescue ArgumentError, ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique, ActiveRecord::RecordNotFound => e
      render json: { error: e.message }, status: :unprocessable_entity
    end

    # POST /organizations/:organization_id/g2/subscriptions/:id/renew
    # Charges for the NEXT period - the subscription itself isn't extended
    # until this invoice is actually paid (see Invoice#mark_paid!).
    def renew
      subscription = current_organization.subscriptions.find(params[:id])
      invoice = G2::Invoice.create_for_renewal!(subscription)

      render json: { invoice: invoice_json(invoice) }, status: :created
    rescue ActiveRecord::RecordNotFound => e
      render json: { error: e.message }, status: :not_found
    end

    # POST /organizations/:organization_id/g2/subscriptions/:id/cancel
    # Stops auto-renew immediately, but access continues until ends_at -
    # already-paid-for time is never revoked early.
    def cancel
      subscription = current_organization.subscriptions.find(params[:id])
      subscription.cancel!

      render json: subscription_json(subscription)
    rescue ActiveRecord::RecordNotFound => e
      render json: { error: e.message }, status: :not_found
    end

    private

    def subscription_json(sub)
      {
        id: sub.id,
        module: sub.module,
        plan: sub.plan,
        status: sub.status,
        starts_at: sub.starts_at,
        ends_at: sub.ends_at
      }
    end

    def invoice_json(invoice)
      {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
        status: invoice.status,
        due_at: invoice.due_at
      }
    end
  end
end
