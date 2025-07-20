import { GoogleAuth, DriveFolder } from '../../types';
import HeaderNavigation from '../HeaderNavigation';

interface FolderSelectionScreenProps {
  googleAuth: GoogleAuth;
  selectedMainFolder: DriveFolder | null;
  clientFolders: DriveFolder[];
  handleClientFolderSelect: (folder: DriveFolder) => void;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
}

export default function FolderSelectionScreen({
  googleAuth,
  selectedMainFolder,
  clientFolders,
  handleClientFolderSelect,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
}: FolderSelectionScreenProps) {


  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
      />
      
      <div className="p-4">
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
            </div>
            
            {/* Admin Access Button */}
            <div className="mt-4">
              <a
                href="/admin/templates"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-md"
              >
                <span>⚙️</span>
                <span>Manage PNG Templates</span>
                <span className="text-xs bg-purple-500 px-2 py-1 rounded">Admin</span>
              </a>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {clientFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleClientFolderSelect(folder)}
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
        </div>
      </div>
    </div>
  );
} 