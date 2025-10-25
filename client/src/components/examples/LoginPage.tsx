import LoginPage from '../LoginPage';

export default function LoginPageExample() {
  const handleLogin = (username: string, password: string) => {
    console.log('Login with:', username, password);
  };

  const handleRegister = (username: string, password: string) => {
    console.log('Register with:', username, password);
  };

  return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
}
