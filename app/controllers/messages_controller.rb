class MessagesController < ApplicationController
  

  def create
    @conversation = Conversation.find(params[:conversation_id])
    @message = Message.new(conversation: @conversation, body: params[:body], sender: current_user)
    if @message.save
      @conversation.participants.each do |participant|
        Turbo::StreamsChannel.broadcast_append_to(
          "conversation_user_#{participant.id}",
          target: "messages_list",
          partial: "conversations/message",
          locals: { message: @message, is_current_user: participant.id == current_user.id }
        )
      end
    end
  end
end
