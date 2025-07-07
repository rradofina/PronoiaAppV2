import { NextPage } from 'next';

const PrivacyPolicy: NextPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          <p className="text-sm text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
              <p className="mb-3">
                Pronoia Photo Studio ("we," "our," or "us") collects the following information when you use our photo selection application:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google Account Information:</strong> When you sign in with Google, we access your email address and basic profile information.</li>
                <li><strong>Google Drive Access:</strong> We access your Google Drive folders and photos only with your explicit permission to facilitate photo selection and print generation.</li>
                <li><strong>Usage Data:</strong> We may collect information about how you interact with our application for improvement purposes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
              <p className="mb-3">We use the collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide access to your photo folders through Google Drive</li>
                <li>Generate and organize print templates based on your selected photos</li>
                <li>Create output folders in your Google Drive for completed prints</li>
                <li>Improve our service and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Storage and Security</h2>
              <p className="mb-3">
                We prioritize the security of your data:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We do not store your photos on our servers</li>
                <li>All photo access is done directly through Google Drive API</li>
                <li>We use secure authentication methods provided by Google</li>
                <li>Your data remains in your Google Drive under your control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
              <p className="mb-3">
                Our application integrates with:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google Drive API:</strong> For accessing and managing your photos and folders</li>
                <li><strong>Google Authentication:</strong> For secure sign-in</li>
                <li><strong>Vercel:</strong> For hosting our application</li>
              </ul>
              <p className="mt-3">
                These services have their own privacy policies, which we encourage you to review.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Revoke access to your Google Drive at any time through your Google Account settings</li>
                <li>Request information about what data we have collected</li>
                <li>Request deletion of your data from our systems</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Information</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at:{' '}
                <a href="mailto:rradofina@gmail.com" className="text-blue-600 hover:text-blue-800">
                  rradofina@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-center text-gray-600">
              <a href="/" className="text-blue-600 hover:text-blue-800">
                ← Back to Pronoia Photo Studio
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 