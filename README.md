   # Go3 Application

   A modern Rails 8 application with PostgreSQL database.

   ## Development Setup

   ### Prerequisites

   - Ruby 3.3.3
   - Rails 8.0.1
   - PostgreSQL 15+
   - Docker and Docker Compose
   - Node.js and Yarn

   ### Email Testing with MailCatcher

   For email testing in development, this application uses MailCatcher.

   1. Install MailCatcher globally (not in your project Gemfile):

      ```bash
      gem install mailcatcher
      ```

   2. Start MailCatcher:

      ```bash
      mailcatcher
      ```

   3. Access the web interface at http://localhost:1080 to view emails

   4. All emails sent by the application will be captured here rather than actually being sent

   When MailCatcher is running, it provides:

   - SMTP server on 127.0.0.1:1025
   - Web interface on 127.0.0.1:1080

   ### Setup with Docker (Recommended)

   1. Clone the repository

      ```bash
      git clone https://github.com/mengiefen/go3.git
      cd go3
      ```

   2. Copy environment file and fill in necessary values

      ```bash
      cp .env.example .env
      ```

   3. Start Docker containers

      ```bash
      docker-compose up
      ```

   4. Access the application at http://localhost:3000

   ### Manual Setup

   1. Clone the repository

      ```bash
      git clone https://github.com/mengiefen/go3.git
      cd go3
      ```

   2. Install dependencies

      ```bash
      bundle install
      ```

   3. Create and setup the database

      ```bash
      bin/rails db:prepare
      ```

   4. Start the Rails server

      ```bash
      bin/rails server
      ```

   5. Access the application at http://localhost:3000

   # Storage Setup

   The application uses Active Storage with a provider-agnostic configuration driven entirely by environment variables. This means you can switch between local disk storage, Cloudflare R2, Backblaze B2, AWS S3, or any S3-compatible provider by only changing environment variables — no code changes required.

   ## Local Development

   By default, files are stored on local disk. No configuration is needed.

   The default storage service is `local`, and files are written to the `storage/` directory.

   ## Using an S3-Compatible Provider

   To use an S3-compatible object storage provider (Cloudflare R2, Backblaze B2, AWS S3, etc.), set the following environment variables in your `.env` file:

   ```env
   ACTIVE_STORAGE_SERVICE=amazon
   STORAGE_ACCESS_KEY_ID=your_access_key_id
   STORAGE_SECRET_ACCESS_KEY=your_secret_access_key
   STORAGE_REGION=auto
   STORAGE_BUCKET=your_bucket_name
   STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```

   ### Environment Variables

   | Variable | Description |
   |---|---|
   | `ACTIVE_STORAGE_SERVICE` | Storage service name (set to `amazon` for S3-compatible providers) |
   | `STORAGE_ACCESS_KEY_ID` | Access key ID from your provider |
   | `STORAGE_SECRET_ACCESS_KEY` | Secret access key from your provider |
   | `STORAGE_REGION` | Storage region (use `auto` for Cloudflare R2) |
   | `STORAGE_BUCKET` | Bucket name |
   | `STORAGE_ENDPOINT` | S3-compatible endpoint URL |

   ## Provider-Specific Examples

   ### Cloudflare R2

   ```env
   ACTIVE_STORAGE_SERVICE=amazon
   STORAGE_ACCESS_KEY_ID=your_r2_access_key_id
   STORAGE_SECRET_ACCESS_KEY=your_r2_secret_access_key
   STORAGE_REGION=auto
   STORAGE_BUCKET=go3-documents
   STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```

   ### Backblaze B2

   ```env
   ACTIVE_STORAGE_SERVICE=amazon
   STORAGE_ACCESS_KEY_ID=your_b2_key_id
   STORAGE_SECRET_ACCESS_KEY=your_b2_application_key
   STORAGE_REGION=us-west-004
   STORAGE_BUCKET=go3-documents
   STORAGE_ENDPOINT=https://s3.us-west-004.backblazeb2.com
   ```

   ### AWS S3

   ```env
   ACTIVE_STORAGE_SERVICE=amazon
   STORAGE_ACCESS_KEY_ID=your_aws_access_key_id
   STORAGE_SECRET_ACCESS_KEY=your_aws_secret_access_key
   STORAGE_REGION=us-east-1
   STORAGE_BUCKET=go3-documents
   STORAGE_ENDPOINT=https://s3.amazonaws.com
   ```

   ## Testing the Storage Connection

   After configuring your environment variables, verify that the storage service resolves correctly:

   ```bash
   rails runner "puts Rails.application.config.active_storage.service"
   ```

   This should print:

   ```text
   amazon
   ```

   Or whatever service you configured.

   ### Testing a File Upload

   To test an upload, open a Rails console and run:

   ```ruby
   org = Organization.first
   member = org.members.first

   File.write("/tmp/test-upload.txt", "Hello storage!")

   doc = Document.create!(
   organization: org,
   documentable: org.journal_entries.first,
   member: member
   )

   doc.attachment.attach(
   io: File.open("/tmp/test-upload.txt"),
   filename: "test-upload.txt",
   content_type: "text/plain"
   )

   doc.save!

   puts doc.attachment.url
   ```

   Check your provider's dashboard, or the local `storage/` directory when using local storage, to confirm that the file was uploaded successfully.

   ## Testing

   ```bash
   bin/rails test
   ```

   ## Deployment

   This application is configured for deployment using Docker containers. See the `Dockerfile` for production builds.

   ## CI/CD

   GitHub Actions are configured for continuous integration. See `.github/workflows/ci.yml` for details.


   # Documentation

   After adding tests for API endpoints:
   - generate documents by running `rake rswag:specs:swaggerize`
   - make sure rails server is running 
   - see documents at [http://localhost:3000/api-docs](http://localhost:3000/api-docs)