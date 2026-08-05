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

    resources :permissions, only: [:index, :create, :destroy] do
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
  end

  resources :users, only: [ :show ]

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

  # Custom route for examples dashboard
  get "examples/dashboard", to: "examples#dashboard", as: :examples_dashboard
  get "examples/test_layout", to: "examples#test_layout", as: :examples_test_layout

  # Tab demo page - single page with dynamic content loading
  get "tab-demo", to: "tab_demo#index", as: :tab_demo
  get "tab-demo/sidebar/:sidebar_type", to: "tab_demo#sidebar_content", as: :tab_demo_sidebar
  get "tab-demo/content/:content_type/:content_id", to: "tab_demo#tab_content", as: :tab_demo_content

  # Reusable tabs components demo
  get "reusable-tabs-demo", to: "reusable_tabs_demo#index", as: :reusable_tabs_demo
  get "reusable-tabs-demo/full", to: "reusable_tabs_demo#full_implementation", as: :reusable_tabs_demo_full
  get "reusable-tabs-demo/test", to: "reusable_tabs_demo#test", as: :reusable_tabs_demo_test
  get "reusable-tabs-demo/sidebar/:sidebar_type", to: "reusable_tabs_demo#sidebar_content", as: :reusable_tabs_demo_sidebar
  get "reusable-tabs-demo/content/:content_type/:content_id", to: "reusable_tabs_demo#tab_content", as: :reusable_tabs_demo_content

  get "app/*path", to: "home#index", constraints: ->(req) { req.format.html? }
  # Defines the root path route ("/")
  root "home#index"

  namespace :api do
    get "translations", to: "translations#index"
    get "/health", to: "health#show"
    post "/echo", to: "echo#create"
    get "/me", to: "me#show"
  end

  # Onboarding routes
  resources :onboarding, only: [ :new ]
end
