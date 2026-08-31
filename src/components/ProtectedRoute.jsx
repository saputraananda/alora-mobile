import { Navigate } from 'react-router-dom';
import PageLoader from './PageLoader.jsx';

export default function ProtectedRoute({ user, showSplash, children }) {
  if (showSplash) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
