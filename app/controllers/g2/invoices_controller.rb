module G2
  class InvoicesController < ApplicationController
    before_action :authenticate_user!

    # GET /organizations/:organization_id/g2/invoices/:id
    def show
      invoice = current_organization.invoices.find(params[:id])
      render json: invoice_json(invoice)
    end

    private

    def invoice_json(invoice)
      {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total: invoice.total,
        status: invoice.status,
        due_at: invoice.due_at,
        paid_at: invoice.paid_at,
        items: invoice.invoice_items.map { |i| item_json(i) },
        payments: invoice.payments.map { |p| payment_json(p) }
      }
    end

    def item_json(item)
      {
        module: item.module,
        plan: item.plan,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        period_start: item.period_start,
        period_end: item.period_end
      }
    end

    def payment_json(payment)
      {
        id: payment.id,
        provider: payment.provider,
        status: payment.payment_status,
        invoice_url: payment.provider_response["invoice_url"]
      }
    end
  end
end