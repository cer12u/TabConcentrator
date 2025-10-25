import Header from '../Header';

export default function HeaderExample() {
  const mockUser = {
    name: '山田太郎',
    avatar: 'https://via.placeholder.com/32/3b82f6/fff?text=Y',
  };

  const handleLogout = () => {
    console.log('Logout triggered');
  };

  return <Header user={mockUser} onLogout={handleLogout} />;
}
