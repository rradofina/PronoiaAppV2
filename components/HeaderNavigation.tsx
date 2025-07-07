export default function HeaderNavigation() {
  return (
    <header className="nav-header">
      <div className="flex items-center">
        <h1 className="text-xl font-bold text-gray-900">
          Pronoia Photo Studio
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="btn-secondary text-sm">
          Help
        </button>
      </div>
    </header>
  );
} 