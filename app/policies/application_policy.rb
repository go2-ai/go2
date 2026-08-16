class ApplicationPolicy
  attr_reader :user, :record, :organization 

  def initialize(user_context, record)
    @user = user_context.user
    @organization = user_context.organization
    @record = record
  end

  def index?
    false
  end

  def show?
    false
  end

  def create?
    false
  end

  def new?
    create?
  end

  def update?
    false
  end

  def edit?
    update?
  end

  def destroy?
    false
  end

  class Scope
    attr_reader :user, :scope, :organization

    def initialize(user_context, scope)
      @user = user_context.user
      @organization = user_context.organization
      @scope = scope
    end

    def resolve
      scope.none
    end
  end
end
