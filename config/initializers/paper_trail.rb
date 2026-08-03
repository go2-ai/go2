require_relative "../../app/models/concerns/versionable"

# Enable PaperTrail globally
PaperTrail.enabled = true

# Configure serialization for object changes
PaperTrail.serializer = PaperTrail::Serializers::JSON

PaperTrail::Version.class_eval do
  def user
    User.find_by(id: whodunnit)
  end
end

PaperTrail::Version.include(Versionable)
