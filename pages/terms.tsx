import { NextPage } from 'next';

const TermsOfService: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Pronoia Studios PH ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
              <p className="mb-3">
                Pronoia Studios PH is a web application that allows users to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Connect to their Google Drive account</li>
                <li>Browse and select photos from their Drive folders</li>
                <li>Create custom print templates (solo prints, collages, photocards, photo strips)</li>
                <li>Generate organized print layouts for photo studio services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Responsibilities</h2>
              <p className="mb-3">As a user of this service, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate information when required</li>
                <li>Use the service only for lawful purposes</li>
                <li>Respect intellectual property rights of photos and content</li>
                <li>Not attempt to harm or disrupt the service</li>
                <li>Keep your Google account credentials secure</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Google Drive Integration</h2>
              <p className="mb-3">
                Our service integrates with Google Drive. By using this service, you acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You grant us permission to access your Google Drive folders and photos as needed</li>
                <li>We will only access content necessary for the photo selection and print generation process</li>
                <li>You can revoke access at any time through your Google Account settings</li>
                <li>Your content remains under your ownership and control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
              <p>
                You retain all rights to photos and content you upload or access through this service. The application code and design are proprietary to Pronoia Studios PH. You may not copy, distribute, or create derivative works without permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Service Availability</h2>
              <p>
                We strive to maintain service availability but do not guarantee uninterrupted access. The service may be temporarily unavailable due to maintenance, updates, or technical issues beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
              <p>
                Pronoia Studios PH shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Privacy</h2>
              <p>
                Your privacy is important to us. Please review our{' '}
                <a href="/privacy" className="text-blue-600 hover:text-blue-800">
                  Privacy Policy
                </a>
                {' '}to understand how we collect, use, and protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Termination</h2>
              <p>
                We may terminate or suspend your access to the service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at:{' '}
                <a href="mailto:rradofina@gmail.com" className="text-blue-600 hover:text-blue-800">
                  rradofina@gmail.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-600">
              <a href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to Pronoia Studios PH
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService; 