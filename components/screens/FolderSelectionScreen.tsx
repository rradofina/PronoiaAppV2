import { GoogleAuth, DriveFolder } from '../../types';

interface FolderSelectionScreenProps {
  googleAuth: GoogleAuth;
  selectedMainFolder: DriveFolder | null;
  clientFolders: DriveFolder[];
  handleDemoClientSelect: (folder: DriveFolder) => void;
  handleClientFolderSelect: (folder: DriveFolder) => void;
  handleBack: () => void;
}

export default function FolderSelectionScreen({
  googleAuth,
  selectedMainFolder,
  clientFolders,
  handleDemoClientSelect,
  handleClientFolderSelect,
  handleBack,
}: FolderSelectionScreenProps) {
  const isDemoMode = googleAuth.userEmail === 'demo@example.com';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Select Client Folder
          </h1>
          <p className="text-gray-600 text-lg">
            Choose the client's photo session folder
          </p>
          <div className="mt-2 text-sm text-blue-600">
            Main folder: {selectedMainFolder?.name}
            {isDemoMode && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {clientFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => isDemoMode ? handleDemoClientSelect(folder) : handleClientFolderSelect(folder)}
                className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent transition-all duration-200"
              >
                <div className="flex items-center">
                  <div className="text-2xl mr-3">👥</div>
                  <div>
                    <p className="font-medium text-gray-800">{folder.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(folder.createdTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {clientFolders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No client folders found in this directory
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            ← Back to Main Folders
          </button>
        </div>
      </div>
    </div>
  );
} 