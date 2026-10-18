# Enable PaperTrail globally
PaperTrail.enabled = true

# Configure serialization for object changes
PaperTrail.serializer = PaperTrail::Serializers::JSON

# PaperTrail::Version comes from the gem and is not reloaded, while Versionable
# (app/models/concerns) is. Including it in to_prepare re-includes the fresh
# module after every code reload in development, so changes to Versionable
# take effect without restarting the server. (Including it once at boot left
# the running server with the old module, e.g. "undefined method
# `subrecord_label' for an instance of PaperTrail::Version".)
Rails.application.config.to_prepare do
  PaperTrail::Version.include(Versionable)
end
