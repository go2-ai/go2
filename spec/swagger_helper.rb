require 'rails_helper'

RSpec.configure do |config|
  config.openapi_root = Rails.root.join('swagger').to_s

  config.openapi_specs = {
    'v1/swagger.yaml' => {
      openapi: '3.0.1',
      info: { title: 'API V1', version: 'v1' },
      servers: [ { url: 'http://localhost:5000', variables: { defaultHost: { default: 'localhost:5000' } } } ],
      tags: [
        { name: 'Authentication', description: 'User authentication endpoints' }
      ]
    },
    'v1/accounting.yaml' => {
      openapi: '3.0.1',
      info: { title: 'Accounting API', version: 'v1' },
      servers: [ { url: 'http://localhost:5000', variables: { defaultHost: { default: 'localhost:5000' } } } ],
      tags: [
        { name: 'Settings', description: 'Organization-level accounting configuration' },
        { name: 'Currencies', description: 'Organization-level currency management' }
      ]
    }
  }

  config.openapi_format = :yaml
  config.openapi_strict_schema_validation = false
end