import LoginPage from '../LoginPage';

export default function LoginPageExample() {
  const handleLogin = async (username: string, password: string) => {
    console.log('Login with:', username, password);
  };

  const handleRegister = async (username: string, email: string, password: string) => {
    console.log('Register with:', username, email, password);
  };

  return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
}
