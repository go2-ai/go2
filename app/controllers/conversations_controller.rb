class ConversationsController < ApplicationController
  def index
    @organization = current_organization
    @conversations = current_user.conversations.where(organization: @organization)
  end

  def contacts
    @organization = current_organization
    @users = current_organization.users.where.not(id: current_user.id)
  end

  def new
    @organization = current_organization
    @users = @organization.users.where(id: params[:user_ids].split(","))
    @conversation = Conversation.new
    @conversation.participants << current_user
    @conversation.participants += @users
  end

  def show
    @conversation = Conversation.find(params[:id])
    authorize @conversation

    @messages = @conversation.messages
                  .order(created_at: :desc)
                  .limit(50)
                  .includes(:sender)
                  .reverse
  end

  def create
    @users = current_organization.users.where(id: params[:user_ids].split(","))
    @conversation = Conversation.new(organization: current_organization)
    @conversation.participants << current_user
    @conversation.participants += @users

    if @conversation.save
      @message = @conversation.messages.build(
        body: params[:body],
        sender: current_user
      )
      if @message.save
        # Broadcast to all participants
        @conversation.participants.each do |participant|
          Turbo::StreamsChannel.broadcast_prepend_to(
            "conversations_list_user_#{participant.id}",
            targets: ".conversations_list",
            partial: "conversations/conversation",
            locals: { conversation: @conversation, current_user: participant, organization: current_organization }
          )
        end
        redirect_to organization_conversation_path(current_organization, @conversation)
      else
        @conversation.destroy
        flash.now[:alert] = "Failed to send message."
        render :new, status: :unprocessable_entity
      end
    else
      flash.now[:alert] = "Failed to create conversation."
      render :new, status: :unprocessable_entity
    end
  end

  def update
  end
end
