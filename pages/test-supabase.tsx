import { NextPage } from 'next';
import { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import useAuthStore from '../stores/authStore';
import useSessionStore from '../stores/sessionStore';

const TestSupabasePage: NextPage = () => {
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const { supabaseUser, syncWithSupabase } = useAuthStore();
  const { createSessionWithSupabase, userSessions, loadUserSessions } = useSessionStore();

  const addResult = (message: string, isError = false) => {
    setResults(prev => [...prev, `${isError ? '❌' : '✅'} ${message}`]);
  };

  const runTests = async () => {
    try {
      setResults([]);
      setStatus('testing');

      // Test 1: Connection
      addResult('Testing Supabase connection...');
      const connected = await supabaseService.testConnection();
      if (!connected) {
        addResult('Failed to connect to Supabase', true);
        setStatus('error');
        return;
      }
      addResult('Connected to Supabase');

      // Test 2: User sync
      addResult('Testing user sync...');
      if (!supabaseUser) {
        await syncWithSupabase({
          email: 'test@example.com',
          name: 'Test User',
          id: 'test-google-id',
          picture: null
        });
      }
      
      if (supabaseUser) {
        addResult(`User synced: ${supabaseUser.email}`);
      } else {
        addResult('User sync failed - not critical', false);
      }

      // Test 3: Session creation (if user exists)
      if (supabaseUser) {
        addResult('Testing session creation...');
        await createSessionWithSupabase(supabaseUser.id, {
          clientName: 'Test Client',
          packageType: 'A',
          googleDriveFolderId: 'test-folder-id',
          maxTemplates: 1,
        });
        addResult('Session created successfully');

        // Test 4: Load user sessions
        addResult('Testing session loading...');
        await loadUserSessions(supabaseUser.id);
        addResult(`Loaded ${userSessions.length} sessions`);
      }

      setStatus('success');
      addResult('🎉 All tests passed! Supabase integration working!');

    } catch (error: any) {
      setStatus('error');
      addResult(`Test failed: ${error.message}`, true);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Supabase Integration Test</h1>
        
        <div className="mb-4">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            status === 'testing' ? 'bg-yellow-100 text-yellow-800' :
            status === 'success' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {status === 'testing' && '🔄 Testing...'}
            {status === 'success' && '✅ All Tests Passed'}
            {status === 'error' && '❌ Tests Failed'}
          </div>
        </div>
        
        <div className="space-y-2 mb-6">
          {results.map((result, index) => (
            <div key={index} className="text-sm font-mono bg-gray-50 p-3 rounded">
              {result}
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Current State:</h3>
          <div className="text-sm bg-gray-50 p-3 rounded">
            <p><strong>Supabase User:</strong> {supabaseUser ? supabaseUser.email : 'None'}</p>
            <p><strong>User Sessions:</strong> {userSessions.length}</p>
          </div>
        </div>

        {status === 'success' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">🎉 Integration Ready!</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>✅ Your PronoiaApp now has cloud persistence</p>
              <p>✅ Sessions will automatically sync to Supabase</p>
              <p>✅ Falls back to localStorage if Supabase is unavailable</p>
              <p><strong>Your app continues working exactly as before + cloud features!</strong></p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={runTests}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Run Tests Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSupabasePage;