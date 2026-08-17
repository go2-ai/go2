Rails.application.routes.draw do
  if Rails.env.development?
    mount GraphiQL::Rails::Engine, at: "/graphiql", graphql_path: "/graphql"
  end
  post "/graphql", to: "graphql#execute"
  mount Rswag::Ui::Engine => "/api-docs"
  mount Rswag::Api::Engine => "/api-docs"

  namespace :users do
    resource :profile, only: [ :show, :edit, :update ], controller: "profiles"
    delete "remove_avatar", to: "profiles#remove_avatar", as: :remove_avatar
    resource :settings, only: [ :edit, :update ], controller: "settings"
    get "profile", to: "profile#show"
    delete "account", to: "settings#destroy_account"
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Device routes with custom controllers
  devise_for :users, controllers: {
    sessions: "users/sessions",
    registrations: "users/registrations",
    passwords: "users/passwords",
    confirmations: "users/confirmations",
    unlocks: "users/unlocks",
    omniauth_callbacks: "users/omniauth_callbacks"
  }

  # Wrap custom devise routes in devise_scope
  devise_scope :user do
    get "confirmation_pending", to: "users/registrations#confirmation_pending", as: :confirmation_pending
    post "resend_confirmation", to: "users/registrations#resend_confirmation", as: :resend_confirmation
  end

  # Two-factor authentication
  resource :two_factor, only: [ :new, :create, :show, :update ], controller: "users/two_factor" do
    get :backup_codes
  end

  delete "two_factor", to: "users/two_factor#destroy", as: :disable_two_factor

  # Two Factor Verification during login
  resource :two_factor_verification, only: [ :show, :update ], controller: "users/two_factor_verification" do
    post :verify_backup_code
  end

  # Social connections management
  resources :social_connections, only: [ :index ], controller: "users/social_connections" do
    delete ":provider", to: "users/social_connections#destroy", on: :collection, as: :destroy
  end

  resources :organizations do
    resources :members do
      collection do
        get :export
      end
      member do
        patch :set_as_admin
        patch :revoke_admin
        post :send_invitation
        patch :archive
        patch :unarchive
      end
    end

    resources :departments do
      collection do
        get :export
      end
    end

    resources :roles do
      collection do
        get :export
      end
    end

    resources :groups

    resources :permissions, only: [ :index, :create, :destroy ] do
      collection do
        get :grantable
      end
    end

    resources :versions, only: [ :index ]

    resources :conversations do
      member do
        post :reply
        post :add_participant
        post :remove_participant
        post :leave
      end

      collection do
        get :contacts
      end
    end

    resources :messages

    namespace :accounting do
      resource :settings, only: [ :show, :update ]
      resources :currencies, only: [ :index, :create, :update, :destroy ]
      resources :center_types, only: [ :index, :create, :update, :destroy ]
      resources :centers, only: [ :index, :show, :create, :update, :destroy ]
      resources :account_categories, only: [ :index, :show, :create, :update, :destroy ]
      resources :ledgers, only: [ :index, :show, :create, :update, :destroy ]
    end
  end

  resources :users, only: [ :show ]
  resource :me, only: [ :show, :update ], controller: "me"

  namespace :admin do
    resources :organizations do
      member do
        patch :archive
        patch :unarchive
      end
      collection do
        get :archived
      end
    end
  end


  get "app/*path", to: "home#index", constraints: ->(req) { req.format.html? }
  # Defines the root path route ("/")
  root "home#index"

  namespace :api do
    get "translations", to: "translations#index"
    get "/health", to: "health#show"
    post "/echo", to: "echo#create"
  end

  # Onboarding routes
  resources :onboarding, only: [ :new ]
end
