import React from 'react';
import { useAuth } from '../providers/AuthProvider';

const Home: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-4">Welcome, {user?.username}!</h1>
      <p className="text-gray-300 mb-4">Email: {user?.email}</p>
      <button
        onClick={logout}
        className="py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
};

export default Home;