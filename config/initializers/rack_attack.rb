AI_CHAT_MESSAGE_PATH = %r{_ai/chats/\d+/messages\z}

class Rack::Attack
  ### Configure Cache ###
  Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

  ### Throttle Spammy Clients ###
  throttle("req/ip", limit: 300, period: 5.minutes) do |req|
    req.ip
  end

  ### Prevent Brute-Force Login Attacks ###
  # Throttle POST requests to /users/sign_in by IP address
  throttle("logins/ip", limit: 5, period: 20.seconds) do |req|
    if req.path == "/users/sign_in" && req.post?
      req.ip
    end
  end

  # Throttle login attempts for a given email parameter
  throttle("logins/email", limit: 5, period: 20.seconds) do |req|
    if req.path == "/users/sign_in" && req.post?
      # Normalize the email, using the same logic as your authentication
      # req.params["user"]["email"].to_s.downcase.gsub(/\s+/, "")
    end
  end
  
  throttle("ai/chat-messages/burst", limit: 30, period: 5.minutes) do |req|
    next unless req.post? && req.path =~ AI_CHAT_MESSAGE_PATH
 
    req.env["warden"]&.user&.id || req.ip
  end
 
  throttle("ai/chat-messages/hourly", limit: 200, period: 1.hour) do |req|
    next unless req.post? && req.path =~ AI_CHAT_MESSAGE_PATH
 
    req.env["warden"]&.user&.id || req.ip
  end

  # Block suspicious requests
  blocklist("block suspicious IPs") do |req|
    # Add any known malicious IPs here
    [ "1.2.3.4", "5.6.7.8" ].include?(req.ip)
  end

  # Lockout IP addresses that are hammering protected pages
  blocklist("fail2ban") do |req|
    # Fail2Ban.filter(req.ip, 'password_reset/email') do
    #   # Count failed password reset attempts for email
    #   req.path.include?('/password') && req.params['email'].present? && req.post?
    # end

    # Use Rack Attack in-memory cache to throttle by IP
    Rack::Attack::Allow2Ban.filter(req.ip, maxretry: 10, findtime: 1.minute, bantime: 1.hour) do
      req.path.include?("/users/sign_in") && req.post?
    end
  end

  ### Custom Throttle Response ###
  self.throttled_responder = lambda do |request|
    [
      429, # status
      { "Content-Type" => "application/json" }, # headers
      [ { error: "Too many requests. Please try again later." }.to_json ] # body
    ]
  end
end
