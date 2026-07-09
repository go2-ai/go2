module G2
  class PaymentsController < ApplicationController
    before_action :authenticate_user!
    before_action :set_invoice

    # POST /organizations/:organization_id/g2/invoices/:invoice_id/payments
    # Safe to call again if a previous attempt expired or failed - each
    # call creates a new G2::Payment row against the same invoice.
    def create
      payment = @invoice.payments.create!(provider: "nowpayments", amount_cents: @invoice.total_cents)

      response = NowPayments::Client.new.create_invoice(
        price_amount: @invoice.total,
        price_currency: "usd",
        order_id: payment.id.to_s,
        order_description: "Invoice #{@invoice.invoice_number}",
        success_url: frontend_invoice_url(@invoice, status: "success"),
        cancel_url: frontend_invoice_url(@invoice, status: "cancelled")
      )

      payment.update!(
        provider_payment_id: response["id"],
        provider_response: payment.provider_response.merge(response)
      )

      render json: { id: payment.id, status: payment.payment_status, invoice_url: response["invoice_url"] },
             status: :created
    rescue NowPayments::Client::Error => e
      render json: { error: e.message }, status: :bad_gateway
    end

    private

    def set_invoice
      @invoice = current_organization.invoices.find(params[:invoice_id])
    end

    # Points at your React app's route - set FRONTEND_URL in your env.
    def frontend_invoice_url(invoice, status:)
      "#{ENV.fetch('FRONTEND_URL')}/invoices/#{invoice.id}?payment=#{status}"
    end
  end
end